class MatrixRain {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.container = document.createElement('div');
        this.container.className = 'matrix-rain';
        this.container.appendChild(this.canvas);
        document.body.appendChild(this.container);

        this.characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');
        this.fontSize = 14;
        this.columns = 0;
        this.drops = [];

        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.animate();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.columns = Math.floor(this.canvas.width / this.fontSize);
        this.drops = Array(this.columns).fill(1);
    }

    animate() {
        // 半透明的黑色背景，形成拖尾效果
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 设置文字样式
        this.ctx.fillStyle = '#0F0';
        this.ctx.font = this.fontSize + 'px monospace';

        // 循环处理每一列
        for (let i = 0; i < this.drops.length; i++) {
            // 随机选择一个字符
            const char = this.characters[Math.floor(Math.random() * this.characters.length)];
            
            // 绘制字符
            this.ctx.fillText(char, i * this.fontSize, this.drops[i] * this.fontSize);

            // 如果达到底部或随机触发，重置到顶部
            if (this.drops[i] * this.fontSize > this.canvas.height && Math.random() > 0.975) {
                this.drops[i] = 0;
            }

            // 移动雨滴
            this.drops[i]++;
        }

        // 性能优化：检查页面是否可见
        if (document.hidden) {
            setTimeout(() => requestAnimationFrame(() => this.animate()), 1000);
        } else {
            requestAnimationFrame(() => this.animate());
        }
    }
}

// 页面加载完成后初始化矩阵雨效果
document.addEventListener('DOMContentLoaded', () => {
    // 检查是否支持Canvas
    if (window.matchMedia('(min-width: 768px)').matches) {
        new MatrixRain();
    }
}); 