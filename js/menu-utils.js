// 菜单交互核心逻辑
document.addEventListener('DOMContentLoaded', () => {
    const hamburgerMenu = document.getElementById('hamburgerMenu');
    const dropdownMenu = document.getElementById('dropdownMenu');
    const mqttConfigModal = document.getElementById('mqttConfigModal');

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

    // 菜单项点击事件
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
                    alert('实时环境监控系统 v1.0\n基于MQTT协议的环境数据采集与可视化');
                    break;
            }
        }
    });
});