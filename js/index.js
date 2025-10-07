
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

// 处理图片
async function processImage(img) {
    return new Promise((resolve, reject) => {
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
function loadAndProcessAmiyaImage() {
    const amiyaImage = new Image();
    amiyaImage.onload = () => {
        processImage(amiyaImage)
            .then(generateParticles)
            .catch(error => {
                console.error('图片处理失败:', error);
                loadingText.textContent = '图片处理失败';
                setTimeout(() => {
                    loadingText.style.display = 'none';
                }, 2000);
            });
    };
    amiyaImage.onerror = () => {
        console.error('图片加载失败');
        loadingText.textContent = '图片加载失败';
        setTimeout(() => {
            loadingText.style.display = 'none';
        }, 2000);
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

// 初始化函数
function initApp() {
    initCanvas();
    animate();
    // 直接加载阿米娅图片
    loadAndProcessAmiyaImage();
}

// 当页面DOM加载完成后初始化应用
document.addEventListener('DOMContentLoaded', initApp);
