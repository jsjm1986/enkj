// 存储管理类
class ExamStorage {
    constructor() {
        this.examData = {
            创建时间: new Date().toISOString(),
            更新时间: new Date().toISOString(),
            试题列表: []
        };
    }

    // 添加试题
    addQuestions(questions, imageInfo) {
        const timestamp = new Date().toISOString();
        const examSection = {
            图片信息: {
                文件名: imageInfo.fileName,
                上传时间: timestamp
            },
            题目列表: questions
        };

        this.examData.试题列表.push(examSection);
        this.examData.更新时间 = timestamp;
        this.saveToLocalStorage();
    }

    // 保存到本地存储
    saveToLocalStorage() {
        localStorage.setItem('examData', JSON.stringify(this.examData));
    }

    // 从本地存储加载
    loadFromLocalStorage() {
        const savedData = localStorage.getItem('examData');
        if (savedData) {
            this.examData = JSON.parse(savedData);
        }
    }

    // 清除所有数据
    clearAll() {
        this.examData.试题列表 = [];
        this.examData.更新时间 = new Date().toISOString();
        this.saveToLocalStorage();
    }

    // 导出为JSON文件
    exportToJSON() {
        const dataStr = JSON.stringify(this.examData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `试题库_${new Date().toLocaleDateString()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // 导出为Excel
    exportToExcel() {
        // 创建工作簿
        const wb = XLSX.utils.book_new();
        
        // 转换数据格式
        const flatData = this.examData.试题列表.flatMap(section => 
            section.题目列表.map(q => ({
                '文件名': section.图片信息.文件名,
                '上传时间': section.图片信息.上传时间,
                '题号': q.题号,
                '题目类型': q.题目类型,
                '题目内容': q.题目内容,
                '知识点': Array.isArray(q.知识点) ? q.知识点.join(', ') : q.知识点,
                '难度': q.难度,
                '分值': q.分值
            }))
        );

        // 创建工作表
        const ws = XLSX.utils.json_to_sheet(flatData);
        
        // 添加工作表到工作簿
        XLSX.utils.book_append_sheet(wb, ws, "试题列表");
        
        // 导出文件
        XLSX.writeFile(wb, `试题库_${new Date().toLocaleDateString()}.xlsx`);
    }
}

// 创建全局实例
const examStorage = new ExamStorage();

// 页面加载时从本地存储加载数据
document.addEventListener('DOMContentLoaded', () => {
    examStorage.loadFromLocalStorage();
}); 