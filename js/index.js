
// 配置对象
const CONFIG = {
    particleSize: 3,         // 粒子大小
    particleMargin: 1,       // 粒子间距
    repulsionRadius: 105,    // 排斥作用范围
    repulsionForce: 1.8,     // 排斥力强度
    friction: 0.15,          // 运动摩擦力
    returnSpeed: 0.01,       // 返回原位的速度
    samplingStep: 5,         // 图像采样步长
    maxDisplayRatio: 0.8,    // 最大显示比例为屏幕的80%
    asyncBatchSize: 200,     // 每批生成的粒子数量
    maxImageSize: 1024,      // 最大图像尺寸限制
    mobile: {                // 移动端配置
        repulsionRadius: 78,
        repulsionForce: 1.9,
        friction: 0.16
    }
};

// 在初始化时检测设备类型
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
if(isMobile) {
    Object.assign(CONFIG, {
        repulsionRadius: CONFIG.mobile.repulsionRadius,
        repulsionForce: CONFIG.mobile.repulsionForce,
        friction: CONFIG.mobile.friction
    });
}

// 系统状态
let state = {
    theme: 'night',          // 固定为夜间模式
    particles: [],
    mouse: { x: -1000, y: -1000 }
};

// DOM元素引用
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const loadingText = document.getElementById('loadingText');

// 初始化画布
function initCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        // 窗口大小改变时重新加载图片
        loadAndProcessAmiyaImage();
    });
}

// 获取粒子颜色（固定为夜间模式）
function getParticleColor(original) {
    const isDark = original === 'dark';
    return isDark ? '#333' : '#ccc';
}

// 粒子类
class Particle {
    constructor(x, y, colorType) {
        this.originalX = x;
        this.originalY = y;
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.originalColor = colorType;
        this.baseColor = getParticleColor(colorType);
    }

    update() {
        const dx = this.x - state.mouse.x;
        const dy = this.y - state.mouse.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // 使用平方衰减公式
        if (distance < CONFIG.repulsionRadius) {
            const angle = Math.atan2(dy, dx);
            const ratio = (CONFIG.repulsionRadius - distance) / CONFIG.repulsionRadius;
            const force = ratio * ratio * CONFIG.repulsionForce;  // 平方衰减

            this.vx += Math.cos(angle) * force;
            this.vy += Math.sin(angle) * force;
        }

        // 返回原位的力
        const returnX = (this.originalX - this.x) * CONFIG.returnSpeed;
        const returnY = (this.originalY - this.y) * CONFIG.returnSpeed;
        this.vx += returnX;
        this.vy += returnY;

        // 摩擦系数
        this.vx *= (1 - CONFIG.friction);
        this.vy *= (1 - CONFIG.friction);

        this.x += this.vx;
        this.y += this.vy;
    }

    draw() {
        ctx.fillStyle = this.baseColor;
        ctx.beginPath();
        ctx.arc(this.x, this.y, CONFIG.particleSize / 2, 0, Math.PI * 2);
        ctx.fill();
    }
}

// 处理图像并返回临时画布
function processImage(img) {
    return new Promise((resolve, reject) => {
        try {
            // 检查图像是否有效
            if (!img || !img.complete || img.width <= 0 || img.height <= 0) {
                console.error('无效的图像对象:', img);
                reject(new Error('无效的图像对象'));
                return;
            }
            
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            
            if (!tempCtx) {
                console.error('无法获取画布上下文');
                reject(new Error('无法获取画布上下文'));
                return;
            }
            
            const canvasWidth = window.innerWidth;
            const canvasHeight = window.innerHeight;
            const maxDisplayWidth = canvasWidth * CONFIG.maxDisplayRatio;
            const maxDisplayHeight = canvasHeight * CONFIG.maxDisplayRatio;

            let { width, height } = img;

            // 确保尺寸是有效的数字
            width = Math.max(1, Math.floor(width));
            height = Math.max(1, Math.floor(height));

            // 限制图像尺寸不超过maxImageSize
            if (width > CONFIG.maxImageSize || height > CONFIG.maxImageSize) {
                const ratio = Math.min(
                    CONFIG.maxImageSize / width,
                    CONFIG.maxImageSize / height
                );
                width = Math.max(1, Math.floor(width * ratio));
                height = Math.max(1, Math.floor(height * ratio));
            }

            // 限制图像尺寸不超过屏幕显示范围
            if (width > maxDisplayWidth || height > maxDisplayHeight) {
                const ratio = Math.min(
                    maxDisplayWidth / width,
                    maxDisplayHeight / height
                );
                width = Math.max(1, Math.floor(width * ratio));
                height = Math.max(1, Math.floor(height * ratio));
            }

            // 再次检查尺寸是否有效
            if (width <= 0 || height <= 0) {
                console.error('计算后得到无效的图像尺寸:', width, height);
                reject(new Error('计算后得到无效的图像尺寸'));
                return;
            }

            tempCanvas.width = width;
            tempCanvas.height = height;
            tempCtx.drawImage(img, 0, 0, width, height);
            console.log('图像处理完成，画布尺寸:', width, height);
            resolve(tempCanvas);
        } catch (error) {
            console.error('图像处理过程中发生错误:', error);
            reject(error);
        }
    });
}

// 生成粒子系统
function generateParticles(imageCanvas) {
    try {
        if (!imageCanvas || !imageCanvas.getContext) {
            throw new Error('无效的画布对象');
        }
        const { width, height } = imageCanvas;
        
        // 添加额外的防御性检查
        if (!width || !height || width <= 0 || height <= 0) {
            throw new Error('无效的图片尺寸');
        }
        
        // 确保尺寸是有效的数字
        const validWidth = Math.max(1, Math.floor(width));
        const validHeight = Math.max(1, Math.floor(height));

        // 清空现有粒子
        state.particles = [];

        // 获取图像数据
        const imgData = imageCanvas.getContext('2d').getImageData(0, 0, validWidth, validHeight);

        // 计算居中位置
        const canvasWidth = window.innerWidth;
        const canvasHeight = window.innerHeight;
        const maxDisplayWidth = canvasWidth * CONFIG.maxDisplayRatio;
        const maxDisplayHeight = canvasHeight * CONFIG.maxDisplayRatio;

        let displayWidth = Math.min(width, maxDisplayWidth);
        let displayHeight = Math.min(height, maxDisplayHeight);

        // 调整图像尺寸以适应 maxDisplayRatio
        if (width > maxDisplayWidth || height > maxDisplayHeight) {
            const ratio = Math.min(maxDisplayWidth / width, maxDisplayHeight / height);
            displayWidth = width * ratio;
            displayHeight = height * ratio;
        }

        const offsetX = (canvasWidth - displayWidth) / 2;
        const offsetY = (canvasHeight - displayHeight) / 2;

        // 采样图像数据
        for (let y = 0; y < validHeight; y += CONFIG.samplingStep) {
            for (let x = 0; x < validWidth; x += CONFIG.samplingStep) {
                const alpha = imgData.data[(y * validWidth + x) * 4 + 3];
                if (alpha > 128) {
                    const brightness = getPixelBrightness(imgData, x, y);
                    state.particles.push(new Particle(
                        x * (displayWidth / width) + offsetX,
                        y * (displayHeight / height) + offsetY,
                        brightness > 128 ? 'light' : 'dark'
                    ));
                }
            }
        }

        // 隐藏加载提示
        loadingText.style.display = 'none';
    } catch (error) {
        console.error('粒子生成失败:', error);
        loadingText.textContent = '粒子生成失败';
        setTimeout(() => {
            loadingText.style.display = 'none';
        }, 2000);
    }
}

// 获取像素亮度
function getPixelBrightness(imgData, x, y) {
    const i = (y * imgData.width + x) * 4;
    return (imgData.data[i] + imgData.data[i + 1] + imgData.data[i + 2]) / 3;
}

// 加载并处理阿米娅图片
function loadAndProcessAmiyaImage(callback) {
    const amiyaImage = new Image();
    amiyaImage.onload = () => {
        processImage(amiyaImage)
            .then((imageCanvas) => {
                generateParticles(imageCanvas);
                // 图片处理完成后调用回调函数
                if (typeof callback === 'function') {
                    callback();
                }
            })
            .catch(error => {
                console.error('图片处理失败:', error);
                loadingText.textContent = '图片处理失败';
                setTimeout(() => {
                    loadingText.style.display = 'none';
                }, 2000);
                // 即使出错也调用回调，避免流程卡住
                if (typeof callback === 'function') {
                    callback();
                }
            });
    };
    amiyaImage.onerror = () => {
        console.error('图片加载失败');
        loadingText.textContent = '图片加载失败';
        setTimeout(() => {
            loadingText.style.display = 'none';
        }, 2000);
        // 即使出错也调用回调，避免流程卡住
        if (typeof callback === 'function') {
            callback();
        }
    };
    amiyaImage.src = 'img/amiya.jpg'; // 使用amiya.jpg作为背景图片
}

// 动画循环
function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    state.particles.forEach(p => {
        p.update();
        p.draw();
    });

    requestAnimationFrame(animate);
}

// 鼠标移动追踪
canvas.addEventListener('mousemove', (e) => {
    state.mouse.x = e.clientX;
    state.mouse.y = e.clientY;
});

// 触摸事件监听
if ('ontouchstart' in window) {
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault(); // 阻止默认事件
        const touch = e.touches[0];
        state.mouse.x = touch.clientX;
        state.mouse.y = touch.clientY;
    });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault(); // 阻止默认事件
        const touch = e.touches[0];
        state.mouse.x = touch.clientX;
        state.mouse.y = touch.clientY;
    });
}

// BGM控制功能
function setupBGMControl() {
    const bgmControl = document.getElementById('bgmControl');
    
    // 检查是否存在bgm元素，如果存在则移除它
    const existingBgm = document.getElementById('bgm');
    if (existingBgm) {
        existingBgm.remove();
    }
    
    // 添加一个简单的回退解决方案：提供一个可点击的链接
    function setupAudioLink() {
        console.log('设置音频链接作为回退方案');
        
        // 创建一个隐藏的音频元素
        const audioElement = document.createElement('audio');
        audioElement.id = 'bgm';
        audioElement.loop = true;
        audioElement.muted = true; // 设置为静音以符合自动播放政策
        audioElement.style.display = 'none';
        
        // 设置音频源
        const sourceElement = document.createElement('source');
        sourceElement.src = 'bgm/lovely.mp3';
        sourceElement.type = 'audio/mpeg';
        
        audioElement.appendChild(sourceElement);
        document.body.appendChild(audioElement);
        
        // 添加错误处理
        audioElement.addEventListener('error', function() {
            console.error('音频元素加载错误:', audioElement.error);
            
            // 如果自动加载失败，显示手动链接
            showManualAudioLink();
        });
        
        // 尝试加载音频
        audioElement.load();
        
        // 尝试自动播放音频（静音状态）
        function attemptAutoPlay() {
            audioElement.play().then(() => {
                console.log('音频已自动播放（静音状态）');
            }).catch(error => {
                console.log('自动播放失败，需要用户交互:', error);
            });
        }
        
        // 尝试自动播放
        attemptAutoPlay();
        
        // 设置控制按钮功能
        bgmControl.innerHTML = '<img src="favicon/music.svg" width="24" height="24" style="display: block; margin: 0 auto;">';
        bgmControl.style.width = '36px';
        bgmControl.style.height = '36px';
        bgmControl.title = '点击播放背景音乐';
        
        bgmControl.addEventListener('click', function() {
            try {
                if (audioElement.paused) {
                    // 取消静音
                    audioElement.muted = false;
                    
                    // 尝试播放
                    audioElement.play().then(() => {
                        console.log('音频开始播放');
                        bgmControl.innerHTML = '<img src="favicon/music.svg" width="24" height="24" style="display: block; margin: 0 auto; opacity: 0.5;">';
                        bgmControl.title = '点击暂停背景音乐';
                    }).catch(error => {
                        console.error('播放失败:', error);
                        // 如果播放失败，显示手动链接
                        showManualAudioLink();
                    });
                } else {
                    // 暂停播放
                    audioElement.pause();
                    console.log('音频已暂停');
                    bgmControl.innerHTML = '<img src="favicon/music.svg" width="24" height="24" style="display: block; margin: 0 auto;">';
                    bgmControl.title = '点击播放背景音乐';
                }
            } catch (error) {
                console.error('控制按钮点击错误:', error);
                showManualAudioLink();
            }
        });
    }
    
    // 显示手动音频链接
    function showManualAudioLink() {
        // 避免重复显示
        if (document.getElementById('manualAudioLink')) return;
        
        console.log('显示手动音频链接');
        
        // 创建一个链接元素
        const audioLink = document.createElement('a');
        audioLink.id = 'manualAudioLink';
        audioLink.href = 'bgm/lovely.mp3';
        audioLink.innerHTML = '<img src="favicon/music.svg" width="24" height="24" style="display: block; margin: 0 auto;">';
        audioLink.style.width = '36px';
        audioLink.style.height = '36px';
        audioLink.style.marginLeft = '5px';
        audioLink.style.padding = '5px';
        audioLink.target = '_blank';
        audioLink.style.marginLeft = '10px';
        audioLink.style.padding = '5px 10px';
        audioLink.style.background = 'rgba(255, 255, 255, 0.2)';
        audioLink.style.border = '1px solid rgba(255, 255, 255, 0.3)';
        audioLink.style.borderRadius = '4px';
        audioLink.style.color = 'white';
        audioLink.style.textDecoration = 'none';
        audioLink.style.cursor = 'pointer';
        audioLink.style.display = 'inline-block';
        
        // 添加到控制按钮旁边
        bgmControl.parentNode.insertBefore(audioLink, bgmControl.nextSibling);
        
        // 更新控制按钮状态
        bgmControl.innerHTML = '<img src="favicon/music.svg" width="24" height="24" style="display: block; margin: 0 auto; opacity: 0.5;">';
        bgmControl.disabled = true;
    }
    
    // 初始化
    console.log('开始设置BGM控制');
    setupAudioLink();
    
    // 添加全局用户交互监听器，提高自动播放成功率
    function handleUserInteraction() {
        console.log('检测到用户交互，尝试播放音频');
        
        // 取消静音
        const audioElement = document.getElementById('bgm');
        if (audioElement) {
            audioElement.muted = false;
            
            // 尝试播放
            audioElement.play().then(() => {
                console.log('用户交互后音频播放成功');
                // 更新控制按钮状态
                if (bgmControl) {
                    bgmControl.innerHTML = '<img src="favicon/music.svg" width="24" height="24" style="display: block; margin: 0 auto; opacity: 0.5;">';
                    bgmControl.title = '点击暂停背景音乐';
                }
            }).catch(error => {
                console.log('用户交互后播放失败:', error);
            });
        }
        
        // 移除监听器，避免重复触发
        document.removeEventListener('click', handleUserInteraction);
        document.removeEventListener('keydown', handleUserInteraction);
        document.removeEventListener('touchstart', handleUserInteraction);
    }
    
    // 添加多种交互事件监听器
    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('keydown', handleUserInteraction);
    document.addEventListener('touchstart', handleUserInteraction);
}

// 键盘彩蛋功能：输入'lc'切换到图片背景
function setupKeyboardEasterEgg() {
    let inputSequence = '';
    const targetSequence = 'lc';
    let isImageBackground = false;
    // 不需要使用originalBgImage变量，因为粒子系统会处理图片加载
    // 使用'img/开始页面.gif'作为彩蛋背景图片，这是一个更适合全屏显示的图片
    const easterEggBgImage = 'img/happy_birthday.jpeg';
    
    // 获取倒计时提示元素
    const countdown提示 = document.getElementById('countdown提示');
    const countdownText = document.getElementById('countdownText');
    const countdownNumber = document.getElementById('countdownNumber');
    
    // 显示倒计时并执行吹气特效的函数
    function showCountdownAndBlowEffect(callback) {
        // 显示倒计时提示
        countdown提示.style.display = 'block';
        let countdown = 5;
        countdownNumber.textContent = countdown;
        
        // 设置倒计时动画
        const countdownInterval = setInterval(() => {
            countdown--;
            countdownNumber.textContent = countdown;
            
            // 添加数字变化动画效果
            countdownNumber.style.transform = 'scale(1.2)';
            setTimeout(() => {
                countdownNumber.style.transform = 'scale(1)';
            }, 300);
            
            if (countdown <= 0) {
                clearInterval(countdownInterval);
                
                // 倒计时结束后，显示吹气提示并立即开始彩蛋页浮现效果
                countdownText.textContent = '开始吹气！';
                countdownNumber.textContent = '💨';
                
                // 立即开始彩蛋页浮现效果，不等待
                performBlowEffect(() => {
                    // 标记为彩蛋背景状态
                    if (typeof callback === 'function') {
                        callback();
                    }
                });
                
                // 特效开始后立即隐藏倒计时提示，确保特效与提示消失时间同步
                setTimeout(() => {
                    countdown提示.style.display = 'none';
                }, 100); // 短暂延迟确保特效已经开始
            }
        }, 1000);
    }
    
    // 吹气特效函数：将粒子从中间吹散，逐渐显示背景
    function performBlowEffect(callback) {
        // 确保画布在最上层显示
        canvas.style.display = 'block';
        
        // 确保粒子已生成
        if (!state.particles || state.particles.length === 0) {
            // 如果粒子还没生成，先加载并处理图片
            loadAndProcessAmiyaImage(() => {
                // 再次检查粒子是否生成
                if (state.particles && state.particles.length > 0) {
                    applyBlowEffect(callback);
                } else {
                    console.warn('粒子系统未初始化，无法执行吹气特效');
                    if (typeof callback === 'function') {
                        callback();
                    }
                }
            });
        } else {
            // 直接应用吹气特效
            applyBlowEffect(callback);
        }
    }
    
    // 添加特效执行标志变量，确保特效只执行一次
    let effectRunning = false;
    
    // 实现彩蛋页从中间以圆形逐渐浮现，同时第一页的纯色背景从中间逐渐以圆形淡出
    function applyBlowEffect(callback) {
        // 防止特效重复执行
        if (effectRunning) {
            console.log('特效已经在运行中，避免重复执行');
            return;
        }
        
        effectRunning = true;
        
        // 从屏幕中心开始，创建圆形浮现效果显示彩蛋背景
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const totalDuration = 9000; // 再增加1.5倍动画持续时间到9秒，使特效更加缓慢和优雅
        const startTime = Date.now();
        
        // 创建一个临时的div用于显示彩蛋背景，并设置为全屏覆盖
        const easterEggContainer = document.createElement('div');
        easterEggContainer.style.position = 'fixed';
        easterEggContainer.style.top = '0';
        easterEggContainer.style.left = '0';
        easterEggContainer.style.width = '100%';
        easterEggContainer.style.height = '100%';
        easterEggContainer.style.zIndex = '1'; // 确保在canvas下面
        easterEggContainer.style.backgroundImage = `url('${easterEggBgImage}')`;
        easterEggContainer.style.backgroundSize = 'cover';
        easterEggContainer.style.backgroundPosition = 'center center';
        easterEggContainer.style.backgroundRepeat = 'no-repeat';
        // 初始设置为完全透明，且使用clip-path使其从中心开始显示
        easterEggContainer.style.opacity = '0';
        // 设置clip-path为一个极小的圆形，从中心开始
        easterEggContainer.style.clipPath = `circle(0% at ${centerX}px ${centerY}px)`;
        document.body.appendChild(easterEggContainer);
        
        // 保存原始canvas样式
        const originalCanvasDisplay = canvas.style.display;
        const originalCanvasZIndex = canvas.style.zIndex;
        
        // 确保canvas在最上层，以便显示粒子和圆形遮罩
        canvas.style.zIndex = '10';
        canvas.style.display = 'block';
        
        // 计算最大半径（屏幕对角线的一半）
        const maxRadius = Math.sqrt(centerX * centerX + centerY * centerY);
        
        // 弹性缓动函数，使动画效果更自然
        function easeOutElastic(t) {
            const c4 = (2 * Math.PI) / 3;
            return t === 0 
                ? 0 
                : t === 1 
                ? 1 
                : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
        }
        
        // 线性缓动函数
        function linearEase(t) {
            return t;
        }
        
        // 绘制背景遮罩函数，实现第一页纯色背景从中间逐渐以圆形淡出
        function drawBackgroundMask() {
            const elapsedTime = Date.now() - startTime;
            let progress = Math.min(elapsedTime / totalDuration, 1);
            
            // 应用弹性缓动
            progress = easeOutElastic(progress);
            
            // 计算当前半径（从中心向外扩散）
            const currentRadius = progress * maxRadius;
            
            // 清除主画布
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // 创建径向渐变，从透明到透明（用于显示彩蛋背景）
            const gradient = ctx.createRadialGradient(
                centerX, centerY, 0,      // 渐变中心和起始半径
                centerX, centerY, currentRadius  // 渐变边缘和结束半径
            );
            gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');    // 中心透明，显示彩蛋背景
            gradient.addColorStop(0.8, 'rgba(0, 0, 0, 0)');  // 过渡区域透明
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');    // 边缘透明，完全显示彩蛋背景
            
            // 使用渐变填充圆形
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(centerX, centerY, currentRadius, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // 更新彩蛋背景clip-path的函数，实现从中间向外扩散的效果
        function updateEasterEggClipPath() {
            const elapsedTime = Date.now() - startTime;
            let progress = Math.min(elapsedTime / totalDuration, 1);
            
            // 应用弹性缓动，与遮罩同步
            progress = easeOutElastic(progress);
            
            // 随着动画进行，增加circle的半径百分比，实现从中心向外扩散
            easterEggContainer.style.clipPath = `circle(${progress * 100}% at ${centerX}px ${centerY}px)`;
            
            // 同时增加透明度，使效果更自然
            easterEggContainer.style.opacity = progress.toString();
        }
        
        // 自定义粒子淡出的update方法
        const originalUpdate = Particle.prototype.update;
        const originalDraw = Particle.prototype.draw;
        
        // 初始化所有粒子的opacity属性，确保它们一开始是可见的
        state.particles.forEach(particle => {
            particle.opacity = 1;
        });
        
        // 优化粒子淡出效果，使其与背景圆形淡出同步，同时实现粒子以圆形逐渐向外扩散
        Particle.prototype.update = function() {
            const elapsedTime = Date.now() - startTime;
            
            if (elapsedTime < totalDuration) {
                // 计算粒子到中心的距离
                const dx = this.x - centerX;
                const dy = this.y - centerY;
                const distanceToCenter = Math.sqrt(dx * dx + dy * dy);
                
                // 计算动画进度
                const overallProgress = elapsedTime / totalDuration;
                const easedProgress = easeOutElastic(overallProgress);
                
                // 计算当前应该消失的半径
                const currentDisappearRadius = easedProgress * maxRadius;
                
                // 根据粒子与中心的距离计算透明度：距离小于当前消失半径的粒子逐渐消失
                if (distanceToCenter < currentDisappearRadius) {
                    // 计算粒子在消失区域内的相对位置
                    const relativePosition = distanceToCenter / currentDisappearRadius;
                    // 越靠近中心的粒子消失得越快
                    this.opacity = 1 - relativePosition;
                }
                // 距离大于当前消失半径的粒子保持可见
                
                // 实现粒子以圆形逐渐向外扩散的特效
                if (easedProgress > 0) {
                    // 减慢移动速度，使扩散效果增加1.5倍时间
                    const moveSpeed = 10 * easedProgress; // 降低速度系数，增加扩散时间
                    
                    // 确保粒子不会原地不动（防止除以0）
                    if (distanceToCenter > 0) {
                        // 计算单位向量，用于确定移动方向
                        const dirX = dx / distanceToCenter;
                        const dirY = dy / distanceToCenter;
                        
                        // 根据方向和速度移动粒子
                        this.x += dirX * moveSpeed;
                        this.y += dirY * moveSpeed;
                    }
                }
                
                // 不需要保留原有的粒子更新逻辑，因为我们希望粒子专注于扩散效果
            } else {
                this.opacity = 0;
            }
        };
        
        Particle.prototype.draw = function() {
            // 只有当透明度大于0时才绘制
            if (this.opacity > 0) {
                ctx.fillStyle = this.baseColor;
                ctx.globalAlpha = this.opacity;
                
                // 随着透明度降低，粒子大小也减小
                const size = CONFIG.particleSize / 2 * this.opacity;
                ctx.beginPath();
                ctx.arc(this.x, this.y, size, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1; // 重置透明度
            }
        };
        
        // 创建动画绘制函数，结合粒子淡出和背景浮现效果
        const animateReveal = function() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // 先绘制背景遮罩，实现圆形浮现效果
            drawBackgroundMask();
            
            // 再绘制粒子，实现淡出效果
            state.particles.forEach(particle => {
                particle.update();
                particle.draw();
            });
            
            // 更新彩蛋背景clip-path，实现从中间向外扩散的效果
            updateEasterEggClipPath();
            
            // 检查动画是否应该继续
            const elapsedTime = Date.now() - startTime;
            if (elapsedTime < totalDuration) {
                requestAnimationFrame(animateReveal);
            }
        };
        
        // 启动粒子淡出和背景浮现动画
        animateReveal();
        
        // 特效动画持续一段时间，让粒子有足够时间淡出并显示彩蛋页
        setTimeout(() => {
            // 恢复原始粒子行为
            Particle.prototype.update = originalUpdate;
            Particle.prototype.draw = originalDraw;
            
            // 清除所有粒子
            if (state && state.particles) {
                state.particles = [];
            }
            
            // 恢复canvas原始样式
            canvas.style.display = originalCanvasDisplay;
            canvas.style.zIndex = originalCanvasZIndex;
            
            // 隐藏canvas，显示完整的彩蛋背景
            canvas.style.display = 'none';
            
            // 确保document.body样式正确，但避免重复设置背景图片
            // 临时的彩蛋容器已经显示了完整的彩蛋背景，不需要再次设置
            document.body.style.overflow = 'auto';
            
            // 特效完成后重置标志，允许再次触发
            effectRunning = false;
            
            // 特效完成后调用回调
            if (typeof callback === 'function') {
                callback();
            }
        }, totalDuration); // 特效持续时间
    }
    
    // 监听键盘输入
    document.addEventListener('keydown', function(e) {
        // 检查是否按下了字母键
        if (/^[a-zA-Z]$/.test(e.key)) {
            // 添加到输入序列
            inputSequence += e.key.toLowerCase();
            
            // 只保留最近的几个字符（与目标序列长度相同）
            if (inputSequence.length > targetSequence.length) {
                inputSequence = inputSequence.slice(-targetSequence.length);
            }
            
            // 检查是否匹配目标序列
            if (inputSequence === targetSequence) {
                // 如果当前不是彩蛋背景
                if (!isImageBackground) {
                    console.log('彩蛋触发：准备显示特效和彩蛋背景');
                    
                    // 显示倒计时和执行整体吹开特效
                    showCountdownAndBlowEffect(function() {
                        // 切换到彩蛋背景
                        isImageBackground = true;
                        console.log('切换到图片背景');
                    });
                } else {
                    // 切换回原始背景
                    console.log('恢复原始背景');
                    isImageBackground = false;
                    document.body.style.backgroundImage = 'none';
                    document.body.style.backgroundColor = 'black';
                    canvas.style.display = 'block';
                    document.body.style.overflow = 'hidden';
                    
                    // 重新加载并处理图片
                    loadAndProcessAmiyaImage();
                }
                
                // 清空输入序列
                inputSequence = '';
            } else {
                // 增强的输入序列验证，避免部分匹配导致的问题
                if (inputSequence !== targetSequence.substring(0, inputSequence.length)) {
                    inputSequence = '';
                }
            }
        }
    });
}

// 初始化函数
function initApp() {
    initCanvas();
    animate();
    // 直接加载阿米娅图片
    loadAndProcessAmiyaImage();
    // 设置BGM控制
    setupBGMControl();
    // 设置键盘彩蛋
    setupKeyboardEasterEgg();
}

// 当页面DOM加载完成后初始化应用
document.addEventListener('DOMContentLoaded', initApp);
