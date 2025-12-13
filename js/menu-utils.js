// 菜单交互核心逻辑
document.addEventListener('DOMContentLoaded', () => {
    const hamburgerMenu = document.getElementById('hamburgerMenu');
    const dropdownMenu = document.getElementById('dropdownMenu');
    const mqttConfigModal = document.getElementById('mqttConfigModal');
    const aboutModal = document.getElementById('aboutModal');
    const aboutModalClose = document.getElementById('aboutModalClose');

    // 点击汉堡菜单切换显隐
    hamburgerMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        hamburgerMenu.classList.toggle('active');
        dropdownMenu.classList.toggle('show');
    });

    // 点击页面其他区域关闭菜单
    document.addEventListener('click', () => {
        hamburgerMenu.classList.remove('active');
        dropdownMenu.classList.remove('show');
    });

    // 关于系统弹窗 关闭按钮
    if (aboutModalClose) {
        aboutModalClose.addEventListener('click', () => {
            aboutModal.classList.remove('show');
        });
    }

    // 点击背景关闭弹窗
    if (aboutModal) {
        aboutModal.addEventListener('click', () => {
            aboutModal.classList.remove('show');  
        });
    }
    // 点击关于系统弹窗内容区域阻止关闭
    const aboutModalContent = aboutModal.querySelector('.modal-content');
    if (aboutModalContent) {
        aboutModalContent.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    // 菜单项点击事件处理
    dropdownMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetItem = e.target.closest('.dropdown-item');
        if (targetItem) {
            const action = targetItem.dataset.action;
            console.log('触发菜单操作：', action);
            
            switch(action) {
                case 'mqtt-config':
                    // 打开MQTT配置弹窗
                    mqttConfigModal.classList.add('show');
                    // 关闭汉堡菜单
                    hamburgerMenu.classList.remove('active');
                    dropdownMenu.classList.remove('show');
                    break;
                case 'data-clear':
                    if (confirm('确定要清空所有历史监控数据吗？')) {
                        console.log('清空历史数据');
                        clearChartData(); // 预留函数
                    }
                    break;
                case 'chart-setting':
                    alert('即将打开图表显示设置界面（后续开发）');
                    break;
                case 'data-export':
                    alert('即将导出监控数据为Excel（后续开发）');
                    break;
                case 'about':
                    // 打开关于系统弹窗
                    aboutModal.classList.add('show');
                    // 关闭汉堡菜单
                    hamburgerMenu.classList.remove('active');
                    dropdownMenu.classList.remove('show');
                    break;
            }
        }
    });
});

