// 获取DOM元素
const fileInput = document.getElementById('fileInput');
const previewSection = document.getElementById('previewSection');
const questionsContainer = document.getElementById('questionsContainer');
const resultSection = document.getElementById('resultSection');
const exportJsonBtn = document.getElementById('exportJson');
const exportExcelBtn = document.getElementById('exportExcel');
const clearDataBtn = document.getElementById('clearData');

// Gemini API配置
const API_KEY = 'AIzaSyCKaip6ZqpieBp-9LelZZJ-1WXTUPZi3H0';
const API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

// PDF.js 配置
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// 存储所有预览图片
let previewImages = [];

// 添加摄像头相关变量
let stream = null;
let videoElement = null;
let cameraActive = false;

// 文件上传处理
fileInput.addEventListener('change', handleFileSelect);

// 处理文件选择
async function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    for (const file of files) {
        if (file.type === 'application/pdf') {
            await handlePdfFile(file);
        } else if (file.type.startsWith('image/')) {
            await handleImageFile(file);
        }
    }
}

// 处理相机拍照
async function handleCameraCapture() {
    const cameraBox = document.getElementById('cameraBox');
    
    if (!cameraActive) {
        // 添加active类
        cameraBox.classList.add('active');
        
        // 隐藏原始内容
        const cameraContent = cameraBox.querySelector('.camera-content');
        if (cameraContent) {
            cameraContent.style.display = 'none';
        }
        
        // 创建视频预览元素
        videoElement = document.createElement('video');
        videoElement.style.width = '100%';
        videoElement.style.height = '100%';
        videoElement.style.objectFit = 'cover';
        videoElement.style.transform = 'scaleX(-1)'; // 镜像显示
        videoElement.autoplay = true;
        videoElement.playsinline = true; // 对iOS很重要
        
        // 创建拍照按钮
        const captureBtn = document.createElement('button');
        captureBtn.className = 'capture-btn';
        captureBtn.innerHTML = '拍照';
        captureBtn.onclick = captureImage;
        
        // 创建切换摄像头按钮（如果设备支持）
        const switchBtn = document.createElement('button');
        switchBtn.className = 'switch-camera-btn';
        switchBtn.innerHTML = '切换摄像头';
        switchBtn.onclick = switchCamera;
        
        // 添加元素到容器
        cameraBox.appendChild(videoElement);
        cameraBox.appendChild(captureBtn);
        
        try {
            // 检查是否支持多个摄像头
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            if (videoDevices.length > 1) {
                cameraBox.appendChild(switchBtn);
            }
            
            // 请求摄像头权限
            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment', // 默认使用后置摄像头
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            });
            
            videoElement.srcObject = stream;
            cameraActive = true;
            
            // 添加关闭按钮
            const closeBtn = document.createElement('button');
            closeBtn.className = 'close-camera-btn';
            closeBtn.innerHTML = '×';
            closeBtn.onclick = stopCamera;
            cameraBox.appendChild(closeBtn);
            
        } catch (error) {
            console.error('访问摄像头失败:', error);
            showError('无法访问摄像头，请确保已授予权限');
            stopCamera();
        }
    }
}

// 拍照功能
function captureImage() {
    if (!videoElement || !cameraActive) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    
    const ctx = canvas.getContext('2d');
    // 如果视频是镜像的，需要翻转回来
    ctx.scale(-1, 1);
    ctx.translate(-canvas.width, 0);
    ctx.drawImage(videoElement, 0, 0);
    
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    addPreviewImage(imageData, `拍照_${new Date().toLocaleTimeString()}.jpg`);
    processImage(imageData);
    
    // 拍照后关闭摄像头
    stopCamera();
}

// 切换摄像头
async function switchCamera() {
    if (!stream) return;
    
    // 获取当前使用的摄像头
    const currentTrack = stream.getVideoTracks()[0];
    const currentFacingMode = currentTrack.getSettings().facingMode;
    
    // 停止当前摄像头
    currentTrack.stop();
    
    try {
        // 请求新的摄像头
        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: currentFacingMode === 'environment' ? 'user' : 'environment',
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            }
        });
        
        videoElement.srcObject = stream;
    } catch (error) {
        console.error('切换摄像头失败:', error);
        showError('切换摄像头失败');
    }
}

// 停止摄像头
function stopCamera() {
    const cameraBox = document.getElementById('cameraBox');
    
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    
    if (videoElement) {
        videoElement.remove();
        videoElement = null;
    }
    
    // 移除所有控制按钮
    const buttons = cameraBox.querySelectorAll('button');
    buttons.forEach(btn => btn.remove());
    
    // 显示原始内容
    const cameraContent = cameraBox.querySelector('.camera-content');
    if (cameraContent) {
        cameraContent.style.display = 'flex';
    }
    
    // 移除active类
    cameraBox.classList.remove('active');
    
    cameraActive = false;
}

// 添加进度指示器状态
const ProcessSteps = {
    UPLOADING: '上传文件',
    PROCESSING: '处理文件',
    COMPRESSING: '压缩图片',
    SENDING: '发送到AI',
    ANALYZING: 'AI分析中',
    PARSING: '解析结果',
    DISPLAYING: '显示结果'
};

// 显示进度状态
function showProgress(step, progress = 0) {
    const progressHtml = `
        <div class="progress-container">
            <div class="progress-status">
                <div class="progress-icon ${progress >= 100 ? 'complete' : ''}">
                    <div class="loading-spinner"></div>
                </div>
                <div class="progress-text">${step}</div>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${progress}%"></div>
            </div>
            <div class="progress-percentage">${Math.round(progress)}%</div>
        </div>
    `;
    questionsContainer.innerHTML = progressHtml;
}

// 修改processImage函数以显示进度
async function processImage(base64Image) {
    try {
        showProgress(ProcessSteps.PROCESSING, 10);
        
        if (base64Image.length > 1024 * 1024) { // 如果图片大于1MB
            showProgress(ProcessSteps.COMPRESSING, 20);
            // 压缩逻辑已经在handleImageFile中实现
        }
        
        showProgress(ProcessSteps.SENDING, 40);
        const questions = await recognizeExam(base64Image);
        
        showProgress(ProcessSteps.ANALYZING, 60);
        await delay(500); // 给用户一个视觉反馈的时间
        
        showProgress(ProcessSteps.PARSING, 80);
        // 保存识别结果
        const currentFile = previewImages[previewImages.length - 1];
        examStorage.addQuestions(questions, {
            fileName: currentFile.fileName
        });
        
        showProgress(ProcessSteps.DISPLAYING, 100);
        await delay(300); // 让用户看到100%的进度
        
        displayQuestions(questions);
    } catch (error) {
        console.error('识别过程出错:', error);
        showError(`识别失败: ${error.message}`);
    }
}

// 修改handleImageFile函数以显示进度
async function handleImageFile(file) {
    try {
        showProgress(ProcessSteps.UPLOADING, 0);
        
        // 检查文件大小
        if (file.size > 4 * 1024 * 1024) { // 4MB限制
            const reader = new FileReader();
            reader.onload = async function(e) {
                showProgress(ProcessSteps.COMPRESSING, 20);
                // 压缩图片
                const img = new Image();
                img.onload = async function() {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    
                    // 如果图片太大，按比例缩小
                    const maxDimension = 1024;
                    if (width > maxDimension || height > maxDimension) {
                        if (width > height) {
                            height = Math.round(height * maxDimension / width);
                            width = maxDimension;
                        } else {
                            width = Math.round(width * maxDimension / height);
                            height = maxDimension;
                        }
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    showProgress(ProcessSteps.PROCESSING, 40);
                    // 压缩质量为0.7
                    const imageData = canvas.toDataURL('image/jpeg', 0.7);
                    addPreviewImage(imageData, file.name);
                    await processImage(imageData);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        } else {
            const reader = new FileReader();
            reader.onload = async function(e) {
                showProgress(ProcessSteps.PROCESSING, 30);
                const imageData = e.target.result;
                addPreviewImage(imageData, file.name);
                await processImage(imageData);
            };
            reader.readAsDataURL(file);
        }
    } catch (error) {
        console.error('处理图片时出错:', error);
        showError('图片处理失败，请重试');
    }
}

// 修改handlePdfFile函数以显示进度
async function handlePdfFile(file) {
    try {
        showProgress(ProcessSteps.UPLOADING, 0);
        
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            showProgress(ProcessSteps.PROCESSING, (pageNum / pdf.numPages) * 30);
            
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 1.5 });
            
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            
            // 限制最大尺寸
            const maxDimension = 1024;
            let width = viewport.width;
            let height = viewport.height;
            
            if (width > maxDimension || height > maxDimension) {
                if (width > height) {
                    height = Math.round(height * maxDimension / width);
                    width = maxDimension;
                } else {
                    width = Math.round(width * maxDimension / height);
                    height = maxDimension;
                }
            }
            
            canvas.height = height;
            canvas.width = width;
            
            const scaledViewport = page.getViewport({ scale: width / viewport.width });
            
            await page.render({
                canvasContext: context,
                viewport: scaledViewport
            }).promise;
            
            const imageData = canvas.toDataURL('image/jpeg', 0.7);
            addPreviewImage(imageData, `${file.name}-第${pageNum}页`);
            await processImage(imageData);
        }
    } catch (error) {
        console.error('处理PDF时出错:', error);
        showError('PDF处理失败，请重试');
    }
}

// 添加预览图片
function addPreviewImage(imageData, fileName) {
    const previewItem = document.createElement('div');
    previewItem.className = 'preview-item';
    
    const img = document.createElement('img');
    img.src = imageData;
    img.alt = fileName;
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.innerHTML = '×';
    removeBtn.onclick = () => {
        previewItem.remove();
        previewImages = previewImages.filter(item => item.fileName !== fileName);
    };
    
    previewItem.appendChild(img);
    previewItem.appendChild(removeBtn);
    previewSection.appendChild(previewItem);
    
    previewImages.push({ fileName, imageData });
}

// 添加重试配置
const API_CONFIG = {
    maxRetries: 3,           // 最大重试次数
    retryDelay: 2000,        // 重试间隔（毫秒）
    timeout: 30000,          // 请求超时时间（毫秒）
    backoffMultiplier: 1.5   // 重试延迟增长倍数
};

// 延迟函数
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// 带超时的fetch
async function fetchWithTimeout(url, options, timeout) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

// 修改recognizeExam函数
async function recognizeExam(base64Image) {
    // 首先验证API密钥
    if (!await validateApiKey()) {
        throw new Error('API密钥无效');
    }

    // 确保base64字符串格式正确
    const imageData = base64Image.startsWith('data:image')
        ? base64Image.split(',')[1]
        : base64Image;

    const requestBody = {
        contents: [{
            parts: [{
                inlineData: {
                    mimeType: "image/jpeg",
                    data: imageData
                }
            }, {
                text: `请仔细分析这张试卷图片，完成以下任务：
1. 识别并分割每一道题目或重要说明
2. 对每个部分进行分类和分析
3. 按照以下格式返回结果（直接返回JSON数组，不要添加其他说明文字）：
[
    {
        "题号": "1",
        "题目类型": "选择题/填空题/解答题/说明",
        "题目内容": "完整的题目文本",
        "知识点": ["涉及的知识点1", "知识点2"],
        "难度": "容易/中等/困难",
        "分值": "题目分值，如果有"
    }
]

注意事项：
- 准确识别题目和说明的边界
- 完整保留数学公式、图表等
- 保持原始格式和换行
- 对于说明性文字，将题目类型设为"说明"
- 如果某些字段无法识别，返回空字符串
- 必须返回标准的JSON格式`
            }]
        }],
        generationConfig: {
            temperature: 0.1,
            topK: 1,
            topP: 0.1,
            maxOutputTokens: 4096,
        }
    };

    let lastError;
    let retryCount = 0;
    let currentDelay = API_CONFIG.retryDelay;

    while (retryCount <= API_CONFIG.maxRetries) {
        try {
            if (retryCount > 0) {
                console.log(`第${retryCount}次重试，等待${currentDelay}ms...`);
                await delay(currentDelay);
                // 更新下一次重试的延迟时间
                currentDelay = Math.min(currentDelay * API_CONFIG.backoffMultiplier, 10000);
            }

            console.log(`开始请求 (尝试 ${retryCount + 1}/${API_CONFIG.maxRetries + 1})`);
            console.log('请求体示例:', {
                ...requestBody,
                contents: [{
                    ...requestBody.contents[0],
                    parts: [
                        { inlineData: { mimeType: "image/jpeg", data: "base64_data..." } },
                        { text: requestBody.contents[0].parts[1].text }
                    ]
                }]
            });
            
            const response = await fetchWithTimeout(
                `${API_ENDPOINT}?key=${API_KEY}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody)
                },
                API_CONFIG.timeout
            );

            if (!response.ok) {
                const errorData = await response.json();
                console.error('API错误情:', errorData);
                console.error('完整错误响应:', await response.text());
                
                // 判断是否需要重试
                if (response.status === 429 || response.status >= 500) {
                    throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
                } else if (response.status === 400) {
                    // 对于400错误，记录更多信息
                    const errorMessage = errorData.error?.message || '未知错误';
                    throw new Error(`请求格式错误: ${errorMessage}`);
                } else {
                    throw new Error(`API请求失败（不再重试）: ${response.status} ${response.statusText}`);
                }
            }

            const data = await response.json();
            console.log('API响应数据:', data);
            console.log('响应文本:', data.candidates?.[0]?.content?.parts?.[0]?.text);
            
            // 检查响应格式
            if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
                throw new Error('API响应格式不正确或响应为空');
            }

            // 修改错误检测逻辑
            const responseText = data.candidates[0].content.parts[0].text;
            // 只检查明确的错误关键词
            if (responseText.toLowerCase().includes('error occurred') || 
                responseText.toLowerCase().includes('unable to process image') ||
                responseText.toLowerCase().includes('无法处理图片') ||
                responseText.toLowerCase().includes('处理失')) {
                throw new Error(`AI返回错误信息: ${responseText}`);
            }

            return parseGeminiResponse(data);

        } catch (error) {
            console.error(`尝试 ${retryCount + 1} 失败:`, error);
            lastError = error;
            
            // 如果是明确的不需要重试的错误，直接抛出
            if (error.message.includes('不再重试') || error.message.includes('请求格式错误')) {
                throw error;
            }
            
            // 如果是超时或网络错误，继续重试
            if (error.name === 'AbortError' || 
                error.message.includes('network') || 
                error.message.includes('timeout')) {
                retryCount++;
                continue;
            }
            
            // 对于其他错误，检查是否还有重试机会
            if (retryCount < API_CONFIG.maxRetries) {
                retryCount++;
                continue;
            }
            
            break;
        }
    }

    // 如果所有重试都失败了
    throw new Error(`在${API_CONFIG.maxRetries}次尝试后调用API失败: ${lastError.message}`);
}

// 验证API密钥
async function validateApiKey() {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
        if (!response.ok) {
            const errorData = await response.json();
            console.error('API密钥验证失败:', errorData);
            showError('API密钥无效或未授权，请检查配置');
            return false;
        }
        console.log('API密钥验证成功');
        return true;
    } catch (error) {
        console.error('验证API密钥时出错:', error);
        showError('无法验证API密钥，请检查网络连接');
        return false;
    }
}

// 在页面加载时验证API密钥
document.addEventListener('DOMContentLoaded', async () => {
    const isValid = await validateApiKey();
    if (!isValid) {
        questionsContainer.innerHTML = `
            <div class="error">
                <p>API密钥验证失败，请确保：</p>
                <ul>
                    <li>在Google Cloud Console中启用了Gemini API</li>
                    <li>API密钥具有正确的权限</li>
                    <li>API密钥格式正确</li>
                </ul>
            </div>
        `;
    }
});

// 修改parseGeminiResponse函数
function parseGeminiResponse(response) {
    try {
        const text = response.candidates[0].content.parts[0].text;
        console.log('开始解析响应文本:', text);
        
        // 从Markdown文本中提取JSON部分
        let jsonText = text;
        
        // 如果响应包含Markdown代码块
        if (text.includes('```')) {
            // 提取JSON代码块
            const matches = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
            if (matches && matches[1]) {
                jsonText = matches[1].trim();
                console.log('提取的JSON文本:', jsonText);
            }
        }
        
        // 预处理JSON文本
        jsonText = jsonText
            .replace(/[\u201C\u201D]/g, '"') // 替换中文引号
            .replace(/[\u2018\u2019]/g, "'") // 替换中文单引号
            .replace(/，/g, ',')  // 替换中文逗号
            .replace(/：/g, ':')  // 替换中文冒号
            .replace(/\[[\s\S]*\]/, match => match.replace(/\n\s*/g, ' ')); // 移除JSON数组中的换行
        
        console.log('预处理后的JSON文本:', jsonText);
        
        // 尝试解析JSON
        try {
            const parsedData = JSON.parse(jsonText);
            console.log('解析后的数据:', parsedData);
            
            // 验证数据结构
            if (!Array.isArray(parsedData)) {
                throw new Error('解析结果不是数组格式');
            }

            // 修改过滤逻辑
            const processedData = parsedData
                .map((item, index) => ({
                    ...item,
                    题号: item.题号 || `${index + 1}`,
                    题目类型: item.题目类型 || '未分类',
                    知识点: Array.isArray(item.知识点) ? item.知识点 : [],
                    难度: item.难度 || '',
                    分值: item.分值 || ''
                }))
                .filter(item => {
                    if (!item.题目内容) return false;
                    
                    // 如果是说明类型的内容，保留它
                    if (item.题目类型?.toLowerCase() === '说明') return true;
                    
                    // 过滤掉一些特定的元数据内容
                    const content = item.题目内容.toLowerCase();
                    const isMetadata = content.includes('printed pages') ||
                                     content.includes('turn over') ||
                                     (content.includes('mark scheme') && content.length < 50); // 只过滤简短的mark scheme提示
                    
                    return !isMetadata;
                });

            if (processedData.length === 0) {
                throw new Error('未能识别出有效的题目内容');
            }

            // 重新编号
            processedData.forEach((item, index) => {
                item.题号 = `${index + 1}`;
            });
            
            return processedData;
        } catch (jsonError) {
            console.error('JSON解析错误:', jsonError);
            throw new Error(`JSON解析失败: ${jsonError.message}`);
        }
    } catch (error) {
        console.error('解析响应时出错:', error);
        console.error('原始响应文本:', response.candidates[0].content.parts[0].text);
        throw error;
    }
}

// 修改displayQuestions函数以处理空数据
function displayQuestions(questions) {
    if (!questions || questions.length === 0) {
        questionsContainer.innerHTML = '<div class="error">未能识别出任何题目</div>';
        return;
    }

    questionsContainer.innerHTML = '';
    questions.forEach((question, index) => {
        const questionElement = document.createElement('div');
        questionElement.className = 'question-item';
        
        // 使用索引+1作为备用题号
        const questionNumber = question.题号 || (index + 1).toString();
        
        // 创建题目标题，包含题号、类型和分值
        const titleParts = [];
        titleParts.push(`第${questionNumber}题`);
        if (question.题目类型) titleParts.push(`[${question.题目类型}]`);
        if (question.分值) titleParts.push(`[${question.分值}分]`);
        
        // 创建HTML内容
        const content = `
            <h3>${titleParts.join(' ')}</h3>
            <div class="question-content">${question.题目内容 || '内容解析失败'}</div>
            ${question.知识点?.length ? `
                <div class="question-tags">
                    <span class="tag-label">知识点：</span>
                    ${question.知识点.map(point => `<span class="tag">${point}</span>`).join('')}
                </div>
            ` : ''}
            ${question.难度 ? `
                <div class="difficulty-tag ${question.难度.toLowerCase()}">
                    难度：${question.难度}
                </div>
            ` : ''}
        `;
        
        questionElement.innerHTML = content;
        questionsContainer.appendChild(questionElement);
    });
}

// 添加导出按钮事件监听
exportJsonBtn.addEventListener('click', () => {
    examStorage.exportToJSON();
});

exportExcelBtn.addEventListener('click', () => {
    examStorage.exportToExcel();
});

clearDataBtn.addEventListener('click', () => {
    if (confirm('确定要清除所有已保存的试题数据吗？')) {
        examStorage.clearAll();
        questionsContainer.innerHTML = '<div class="info">数据已清除</div>';
    }
});

// 添加相机点击事件监听
document.getElementById('cameraBox').addEventListener('click', function(e) {
    if (!cameraActive) {
        handleCameraCapture();
    }
}); 