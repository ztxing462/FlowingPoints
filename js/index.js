
// 配置对象
const CONFIG = {
    particleSize: 3,// 粒子大小，约1mm
    particleMargin: 1,//粒子间距
    repulsionRadius: 90,//排斥作用范围
    repulsionForce: 1.7,//排斥力强度
    friction: 0.15,//运动摩擦力
    returnSpeed: 0.01,//返回原位的速度
    samplingStep: 5,  // 图像采样步长
    maxDisplayRatio: 0.8, // 最大显示比例为屏幕的80%
    asyncBatchSize: 200,    // 每批生成的粒子数量
    maxImageSize: 1024 // 最大图像尺寸限制
};

// 系统状态
let state = {
    theme: 'night',
    particles: [],
    currentImage: null,
    mouse: { x: -1000, y: -1000 }
};

// DOM元素引用
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const themeToggle = document.getElementById('themeToggle');
const uploadBox = document.getElementById('uploadBox');

/* 核心功能模块 */

// 初始化画布
function initCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });
}

// 主题切换功能
function toggleTheme() {
    state.theme = state.theme === 'night' ? 'day' : 'night';
    document.body.setAttribute('data-theme', state.theme);
    themeToggle.textContent = state.theme === 'night' ? '🌙' : '☀️';

    // 更新现有粒子颜色
    state.particles.forEach(p => {
        p.baseColor = getParticleColor(p.originalColor);
    });
}

// 获取粒子颜色
function getParticleColor(original) {
    const isDark = original === 'dark';
    return state.theme === 'night' ?
        (isDark ? '#333' : '#ccc') :
        (isDark ? '#ccc' : '#000');
}

// 侧边栏开关
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');



// 切换侧边栏
sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
});

// 处理侧边栏图片点击事件
document.querySelectorAll('.sidebar-image').forEach(image => {
    image.addEventListener('click', async () => {
        const file = {
            type: 'image/png',
            name: image.alt,
            src: image.dataset.src
        };

        try {
            // 显示加载提示
            loadingText.style.display = 'block';
            const img = new Image();
            img.src = image.dataset.src;

            // 调用 processImage 函数处理图片
            const processedImage = await processImage(file, img);
            generateParticles(processedImage);
        } catch (error) {
            console.error('图片处理失败:', error);
            alert('图片处理失败: ' + error.message);
        } finally {
            loadingText.style.display = 'none';
        }
    });
});

/// 图片处理模块
async function processImage(file, img = null) {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/')) {
            return reject(new Error('请选择图片文件'));
        }

        if (!img) {
            img = new Image();
        }

        img.onload = function () {
            try {
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');

                // 计算屏幕显示的最大尺寸
                const canvasWidth = window.innerWidth;
                const canvasHeight = window.innerHeight;
                const maxDisplayWidth = canvasWidth * CONFIG.maxDisplayRatio;
                const maxDisplayHeight = canvasHeight * CONFIG.maxDisplayRatio;

                let width = img.width;
                let height = img.height;

                // 限制图像尺寸不超过 maxImageSize
                if (width > CONFIG.maxImageSize || height > CONFIG.maxImageSize) {
                    const ratio = Math.min(
                        CONFIG.maxImageSize / width,
                        CONFIG.maxImageSize / height
                    );
                    width *= ratio;
                    height *= ratio;
                }

                // 限制图像尺寸不超过屏幕显示范围
                if (width > maxDisplayWidth || height > maxDisplayHeight) {
                    const ratio = Math.min(
                        maxDisplayWidth / width,
                        maxDisplayHeight / height
                    );
                    width *= ratio;
                    height *= ratio;
                }

                tempCanvas.width = width;
                tempCanvas.height = height;
                tempCtx.drawImage(img, 0, 0, width, height);
                resolve(tempCanvas);
            } catch (error) {
                reject(error);
            }
        };

        img.onerror = () => {
            reject(new Error('图片加载失败，请检查图片路径或文件是否正确'));
        };

        // 设置图片路径
        img.src = img.src || URL.createObjectURL(file);
    });
}

// 生成粒子系统
function generateParticles(imageCanvas) {
    try {
        if (!imageCanvas || !imageCanvas.getContext) {
            throw new Error('无效的画布对象');
        }
        const { width, height } = imageCanvas;
        if (width <= 0 || height <= 0) {
            throw new Error('无效的图片尺寸');
        }

        // 清空现有粒子
        state.particles = [];

        // 获取图像数据
        const imgData = imageCanvas.getContext('2d').getImageData(0, 0, width, height);

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
        for (let y = 0; y < height; y += CONFIG.samplingStep) {
            for (let x = 0; x < width; x += CONFIG.samplingStep) {
                const alpha = imgData.data[(y * width + x) * 4 + 3];
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

        // 隐藏上传界面
        uploadBox.style.display = 'none';

        // 添加重新上传按钮
        if (!document.getElementById('reuploadBtn')) {
            const btn = document.createElement('button');
            btn.id = 'reuploadBtn';
            btn.innerHTML = '🔄 更换图片';
            btn.style.position = 'fixed';
            btn.style.top = '70px';
            btn.style.right = '30px';
            btn.style.zIndex = 1000;
            btn.style.padding = '10px 20px';
            btn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            btn.style.border = 'none';
            btn.style.borderRadius = '20px';
            btn.style.color = 'var(--text-color)';
            btn.style.cursor = 'pointer';
            btn.style.transition = 'background 0.3s';
            // 修改为触发文件选择器
            btn.onclick = () => fileInput.click();
            document.body.appendChild(btn);
        }
    } catch (error) {
        alert('粒子生成失败: ' + error.message);
        uploadBox.style.display = 'flex';
    }
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

        // 增强返回原位的力
        const returnX = (this.originalX - this.x) * CONFIG.returnSpeed;
        const returnY = (this.originalY - this.y) * CONFIG.returnSpeed;
        this.vx += returnX;
        this.vy += returnY;

        // 增强摩擦系数
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

/* 事件监听 */

// 主题切换
themeToggle.addEventListener('click', toggleTheme);

// 文件上传处理
uploadBox.addEventListener('click', () => {
    fileInput.click();
});


// 创建隐藏的文件输入
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = 'image/*';
fileInput.style.display = 'none';
document.body.appendChild(fileInput);

fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        try {
            // 显示加载提示
            loadingText.style.display = 'block';
            const processedImage = await processImage(file);
            generateParticles(processedImage);
        } catch (error) {
            alert('图片处理失败: ' + error.message);
        } finally {
            loadingText.style.display = 'none';
        }
    }
});

// 拖放上传支持
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', async (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) {
        const processedImage = await processImage(file);
        generateParticles(processedImage);
    }
});

// 鼠标移动追踪
canvas.addEventListener('mousemove', (e) => {
    state.mouse.x = e.clientX;
    state.mouse.y = e.clientY;
});

// 触摸事件监听
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

/* 辅助函数 */

function getPixelBrightness(imgData, x, y) {
    const i = (y * imgData.width + x) * 4;
    return (imgData.data[i] + imgData.data[i + 1] + imgData.data[i + 2]) / 3;
}

// 动画循环
function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = state.theme === 'night' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    state.particles.forEach(p => {
        p.update();
        p.draw();
    });

    requestAnimationFrame(animate);
}

/* 初始化 */
initCanvas();
animate();
