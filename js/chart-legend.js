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

// 刷新函数（预留）
function handleChartRefresh() {
    console.log('刷新按钮被点击，逻辑处理待实现');
    // TODO: 在这里添加刷新逻辑
}
