// 图例点击事件处理
document.addEventListener('DOMContentLoaded', () => {
    // 等待图表初始化
    setTimeout(() => {
        const legendItems = document.querySelectorAll('.legend-item');
        const seriesMap = {
            'temperature': 0,
            'humidity': 1,
            'windSpeed': 2,
            'illumination': 3,
            'PM2': 4,
            'sunray': 5
        };
        
        const seriesNames = ['温度', '湿度', '风速', '光照', 'PM2.5', '紫外线'];
        
        legendItems.forEach(item => {
            item.addEventListener('click', function() {
                const seriesName = this.getAttribute('data-series');
                const seriesIndex = seriesMap[seriesName];
                
                // 切换激活状态
                this.classList.toggle('inactive');
                
                // 获取图表实例
                const chartDom = document.getElementById('combined-chart');
                if (chartDom && typeof echarts !== 'undefined') {
                    const chartInstance = echarts.getInstanceByDom(chartDom);
                    if (chartInstance) {
                        chartInstance.dispatchAction({
                            type: 'legendToggleSelect',
                            name: seriesNames[seriesIndex]
                        });
                    }
                }
            });
        });
    }, 600);
});

// 刷新按钮事件绑定
document.addEventListener('DOMContentLoaded', () => {
    const refreshBtn = document.getElementById('chartRefreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', handleChartRefresh);
    }
});

// 刷新函数
function handleChartRefresh() {
    const btn = document.getElementById('chartRefreshBtn');
    if (!btn || btn.classList.contains('refreshing')) return;

    // 添加动画类前强制移除可能的旧状态
    btn.classList.remove('refreshing');
    
    // 强制浏览器重排，确保动画重置
    void btn.offsetWidth;

    // 添加动画类
    btn.classList.add('refreshing');

    // 📤 发送历史数据请求获取最新数据
    if (window.sendHistoryDataRequest) {
        const sent = window.sendHistoryDataRequest();
        if (sent) {
            console.log('📤 刷新：已发送历史数据请求');
            if (typeof ToastAlert !== 'undefined' && ToastAlert.show) {
                ToastAlert.show('正在刷新数据...');
            }
        } else {
            // MQTT未连接时，仅刷新图表显示
            const chartDom = document.getElementById('combined-chart');
            if (chartDom && typeof echarts !== 'undefined') {
                const chartInstance = echarts.getInstanceByDom(chartDom);
                if (chartInstance) {
                    chartInstance.resize();
                }
            }
            if (typeof ToastAlert !== 'undefined' && ToastAlert.show) {
                ToastAlert.show('MQTT未连接，无法获取数据');
            }
        }
    } else {
        // 降级：仅执行图表 resize
        const chartDom = document.getElementById('combined-chart');
        if (chartDom && typeof echarts !== 'undefined') {
            const chartInstance = echarts.getInstanceByDom(chartDom);
            if (chartInstance) {
                chartInstance.resize();
            }
        }
    }
    
    // 动画持续1秒后移除
    setTimeout(() => {
        btn.classList.remove('refreshing');
    }, 1000);
}
