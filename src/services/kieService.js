/**
 * Kie.ai API Service
 * Handles file uploads, video generation, and status polling for Veo 3.1
 * Proxied via Vite to avoid CORS issues in development.
 */

const KIE_PROXY = '/api-kie';
const UPLOAD_PROXY = '/api-upload';
const KIE_API_KEY = '9d3b52f1f97cecb55a4e9c1f97d75216';

/**
 * Helper for fetch with timeout
 */
async function fetchWithTimeout(resource, options = {}) {
  const { timeout = 60000 } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

/**
 * Safely parses JSON response and handles non-JSON errors
 */
async function handleResponse(response) {
  const contentType = response.headers.get('content-type');

  if (!response.ok) {
    if (contentType && contentType.includes('application/json')) {
      const errorData = await response.json();
      throw new Error(errorData.msg || `Server error: ${response.status}`);
    } else {
      const text = await response.text();
      // Look for common HTML error patterns to provide a better message
      if (text.includes('The page cannot be found') || text.includes('404')) {
        throw new Error(`Endpoint not found (404). Please check proxy configuration.`);
      }
      throw new Error(`Server returned non-JSON error (${response.status}). The service might be temporarily down.`);
    }
  }

  if (!contentType || !contentType.includes('application/json')) {
    const text = await response.text();
    console.error('Unexpected non-JSON response:', text);
    throw new Error('Server returned an invalid response format (HTML instead of JSON).');
  }

  return await response.json();
}

/**
 * Uploads a base64 image to Kie.ai
 * Using the RedPanda backend which often handles these file uploads
 */
export const uploadImage = async (base64Data) => {
  const data = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;

  try {
    // Try RedPanda upload first
    const response = await fetchWithTimeout(`${UPLOAD_PROXY}/api/file-base64-upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KIE_API_KEY}`
      },
      body: JSON.stringify({
        base64Data: data,
        fileName: `actor_${Date.now()}.jpg`,
        uploadPath: 'ad-factory/images'
      })
    });

    // If RedPanda fails with 404, try the main Kie API as fallback
    if (response.status === 404) {
      console.warn('RedPanda upload 404, falling back to main Kie API...');
      return await uploadImageFallback(base64Data);
    }

    const result = await handleResponse(response);

    if (result.code !== 200) {
      throw new Error(result.msg || 'Image upload failed');
    }

    return result.data.downloadUrl;
  } catch (error) {
    console.error('Kie.ai Upload Error:', error);
    if (error.name === 'AbortError') throw new Error('Image upload timed out (60s)');
    throw error;
  }
};

/**
 * Fallback upload to main Kie API
 */
async function uploadImageFallback(base64Data) {
  const data = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  const response = await fetchWithTimeout(`${KIE_PROXY}/api/file-base64-upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${KIE_API_KEY}`
    },
    body: JSON.stringify({
      base64Data: data,
      fileName: `actor_${Date.now()}.jpg`,
      uploadPath: 'ad-factory/images'
    })
  });

  const result = await handleResponse(response);
  if (result.code !== 200) {
    throw new Error(result.msg || 'Image upload fallback failed');
  }

  return result.data.downloadUrl;
}

/**
 * Generates a video
 */
export const generateAdVideo = async (options, onProgress) => {
  const { prompt, imageUrl, model = 'veo3_fast', aspectRatio = '9:16' } = options;

  let finalImageUrl = imageUrl;

  if (imageUrl && imageUrl.startsWith('data:')) {
    if (onProgress) onProgress('Preparing digital actor...', 10);
    finalImageUrl = await uploadImage(imageUrl);
  }

  if (onProgress) onProgress('Submitting to VEO engine...', 20);

  const requestBody = {
    prompt,
    model: model,
    aspectRatio: aspectRatio,
    enableTranslation: false,
    imageUrls: finalImageUrl ? [finalImageUrl] : [],
    generationType: finalImageUrl ? 'FIRST_AND_LAST_FRAMES_2_VIDEO' : 'TEXT_2_VIDEO'
  };

  try {
    const response = await fetchWithTimeout(`${KIE_PROXY}/api/v1/veo/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KIE_API_KEY}`
      },
      body: JSON.stringify(requestBody)
    });

    const data = await handleResponse(response);

    if (data.code !== 200) {
      throw new Error(data.msg || 'API request failed');
    }

    return { taskId: data.data?.taskId, imageUrl: finalImageUrl };
  } catch (error) {
    console.error('Kie.ai Generation Error:', error);
    if (error.name === 'AbortError') throw new Error('Generation request timed out');
    throw error;
  }
};

/**
 * Internal helper to parse polling response and extract status/URL
 */
function parsePollingData(data) {
  const taskData = data.data || {};

  // High-level completion markers
  const containsVideo = !!(
    taskData.videoUrl ||
    taskData.mp4Url ||
    taskData.url ||
    (taskData.response?.resultUrls && taskData.response.resultUrls.length > 0) ||
    (taskData.videoInfo?.videoUrl) ||
    (taskData.recordInfo?.videoUrl)
  );

  // Status mapping: 
  // Code 1 is success in most recent docs
  // successFlag 1 is success in others
  // status 2 is success in some older ones
  // state "success" is also used
  const isSuccess = (
    taskData.status === 1 ||
    taskData.status === 2 || // Handle older status mapping where 2 = success
    taskData.successFlag === 1 ||
    taskData.state === 'success' ||
    containsVideo
  );

  // Enhanced failure detection - catch all rejection scenarios from Kie
  // We check for EXPLICIT error fields that Kie uses when a task terminal-fails
  const hasExplicitError = !!(
    taskData.errorMsg ||
    taskData.errorMessage ||
    taskData.failMsg ||
    taskData.failMessage ||
    taskData.rejectReason ||
    taskData.rejectMsg
  );

  const isFailed = (
    taskData.status === 3 ||
    taskData.status === 4 ||
    taskData.status === -1 ||
    taskData.state === 'fail' ||
    taskData.state === 'failed' ||
    taskData.state === 'rejected' ||
    taskData.state === 'error' ||
    taskData.state === 'cancelled' ||
    taskData.successFlag === 0 ||
    taskData.successFlag === -1 ||
    // Only treat "hasErrorMessage" as failure if the status is actually terminal
    // (Kie sometimes includes msg: "success" or progress updates in common fields)
    (hasExplicitError && !containsVideo && (taskData.status > 2 || taskData.status < 0 || taskData.state === 'fail' || taskData.state === 'failed' || taskData.state === 'rejected'))
  );

  // Exhaustive URL extraction
  let finalUrl = taskData.videoUrl || taskData.mp4Url || taskData.url;

  if (!finalUrl && taskData.response?.resultUrls?.length > 0) {
    finalUrl = taskData.response.resultUrls[0];
  }
  if (!finalUrl && taskData.videoInfo?.videoUrl) {
    finalUrl = taskData.videoInfo.videoUrl;
  }
  if (!finalUrl && taskData.recordInfo?.videoUrl) {
    finalUrl = taskData.recordInfo.videoUrl;
  }

  // Comprehensive error message extraction
  const errorMessage =
    taskData.errorMsg ||
    taskData.errorMessage ||
    taskData.failMsg ||
    taskData.failMessage ||
    taskData.rejectReason ||
    taskData.rejectMsg ||
    taskData.reason ||
    taskData.msg ||
    null;

  return {
    isCompleted: isSuccess && !!finalUrl,
    isFailed: isFailed,
    videoUrl: finalUrl,
    error: errorMessage,
    progress: taskData.progress || 0
  };
}

/**
 * Polls status using multiple possible endpoints as fallback
 */
export const pollTaskStatus = async (taskId) => {
  // We'll try the universal jobs/recordInfo first, then the specific veo/record-info
  const endpoints = [
    `${KIE_PROXY}/api/v1/jobs/recordInfo?taskId=${taskId}`,
    `${KIE_PROXY}/api/v1/veo/record-info?taskId=${taskId}`
  ];

  let lastError = null;

  for (const url of endpoints) {
    try {
      const response = await fetchWithTimeout(url, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${KIE_API_KEY}` },
        timeout: 10000 // 10 second timeout for polling
      });

      if (!response.ok) continue;

      const data = await handleResponse(response);
      console.log(`Kie.ai Polling [${url.split('/').pop().split('?')[0]}]:`, data);

      if (data.code === 200 && data.data) {
        const parsed = parsePollingData(data);
        console.log('📊 Parsed polling data:', {
          status: parsed.isCompleted ? 'completed' : (parsed.isFailed ? 'failed' : 'processing'),
          hasVideoUrl: !!parsed.videoUrl,
          videoUrl: parsed.videoUrl,
          progress: parsed.progress,
          error: parsed.error
        });

        if (parsed.isCompleted && !parsed.videoUrl) {
          console.warn('⚠️ Task marked complete but no video URL found!');
          console.warn('Raw task data:', data.data);
        }

        if (parsed.isFailed) {
          console.error('❌ Kie.ai task FAILED/REJECTED:', {
            error: parsed.error,
            rawData: data.data
          });
        }

        return {
          status: parsed.isCompleted ? 'completed' : (parsed.isFailed ? 'failed' : 'processing'),
          videoUrl: parsed.videoUrl,
          error: parsed.error,
          progress: parsed.progress
        };
      }
    } catch (err) {
      lastError = err;
      console.warn(`Polling attempt to ${url} failed:`, err);
    }
  }

  throw lastError || new Error('All polling endpoints failed');
};

/**
 * Generates a reference/actor image using Nano Banana Pro model
 * @param {Object} options - Generation options
 * @param {string} options.prompt - Text description of the image to generate
 * @param {string} options.aspectRatio - Aspect ratio (1:1, 3:4, 4:3, 9:16, 16:9, etc.) Default: 1:1
 * @param {string} options.resolution - Resolution (1K, 2K, 4K) Default: 1K
 * @param {string} options.outputFormat - Output format (png, jpg) Default: png
 * @param {Array} options.referenceImages - Optional array of reference image URLs (up to 8)
 * @param {Function} onProgress - Progress callback
 * @returns {Object} { taskId }
 */
export const generateReferenceImage = async (options, onProgress) => {
  const {
    prompt,
    aspectRatio = '1:1',
    resolution = '1K',
    outputFormat = 'png',
    referenceImages = []
  } = options;

  if (!prompt || prompt.trim().length === 0) {
    throw new Error('Prompt is required for image generation');
  }

  if (onProgress) onProgress('Submitting to Nano Banana Pro...', 10);

  const requestBody = {
    model: 'nano-banana-pro',
    input: {
      prompt: prompt.trim(),
      image_input: referenceImages,
      aspect_ratio: aspectRatio,
      resolution: resolution,
      output_format: outputFormat
    }
  };

  try {
    const response = await fetchWithTimeout(`${KIE_PROXY}/api/v1/jobs/createTask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KIE_API_KEY}`
      },
      body: JSON.stringify(requestBody)
    });

    const data = await handleResponse(response);

    if (data.code !== 200) {
      throw new Error(data.msg || 'Failed to create image generation task');
    }

    if (!data.data?.taskId) {
      throw new Error('API failed to return a valid Task ID');
    }

    if (onProgress) onProgress('Image generation started...', 20);

    return { taskId: data.data.taskId };
  } catch (error) {
    console.error('Nano Banana Pro Generation Error:', error);
    if (error.name === 'AbortError') throw new Error('Image generation request timed out');
    throw error;
  }
};

/**
 * Polls the status of an image generation task
 * @param {string} taskId - The task ID to poll
 * @returns {Object} { status: 'waiting'|'success'|'fail', imageUrls: string[], error: string|null }
 */
export const pollImageTaskStatus = async (taskId) => {
  try {
    const response = await fetchWithTimeout(
      `${KIE_PROXY}/api/v1/jobs/recordInfo?taskId=${taskId}`,
      {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${KIE_API_KEY}` }
      }
    );

    const data = await handleResponse(response);
    console.log('Nano Banana Pro Poll:', data);

    if (data.code !== 200 || !data.data) {
      throw new Error(data.msg || 'Failed to get task status');
    }

    const taskData = data.data;
    const state = taskData.state; // 'waiting', 'success', 'fail'

    // Parse resultJson if available
    let imageUrls = [];
    if (taskData.resultJson) {
      try {
        const resultData = typeof taskData.resultJson === 'string'
          ? JSON.parse(taskData.resultJson)
          : taskData.resultJson;
        imageUrls = resultData.resultUrls || [];
      } catch (parseError) {
        console.warn('Failed to parse resultJson:', parseError);
      }
    }

    return {
      status: state,
      imageUrls: imageUrls,
      error: taskData.failMsg || null,
      costTime: taskData.costTime || null
    };
  } catch (error) {
    console.error('Image task polling error:', error);
    throw error;
  }
};

/**
 * Gets a temporary downloadable URL for a generated file
 * Bypasses CORS and CDN restrictions for downloads
 */
export const getDownloadUrl = async (fileUrl) => {
  if (!fileUrl) return null;

  try {
    const response = await fetchWithTimeout(`${KIE_PROXY}/api/v1/common/download-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KIE_API_KEY}`
      },
      body: JSON.stringify({ fileUrl })
    });

    const data = await handleResponse(response);

    if (data.code !== 200 || !data.data) {
      throw new Error(data.msg || 'Failed to generate download URL');
    }

    // The API usually returns the link in data.data directly
    return data.data;
  } catch (error) {
    console.error('Error fetching download URL:', error);
    // Fallback to original URL if this fails, though it might fail too
    return fileUrl;
  }
};
