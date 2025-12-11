// 全局数据（保留初始空数组，初始化时补默认值）
window.chartData = {
    time: [],
    temperature: [],
    humidity: [],
    windSpeed: [],
    illumination: []
};
// 全局图表实例（确保可访问）
let mainChart, lightChart;

// 初始化图表（保留所有样式+修复空数据报错）
window.initCharts = function() {
    const mainChartDom = document.getElementById('main-chart');
    const lightChartDom = document.getElementById('light-chart');
    
    // 验证容器存在
    if (!mainChartDom || !lightChartDom) {
        console.error('图表容器未找到！');
        return;
    }

    // 1. 温/湿/风 图表（保留smooth/lineStyle）
    mainChart = echarts.init(mainChartDom);
    const mainOption = {
        title: { text: '温/湿/风 趋势' },
        tooltip: { trigger: 'axis' },
        legend: { data: ['温度(℃)', '湿度(%)', '风速(m/s)'], top: 10 },
        grid: { left: '3%', right: '3%', bottom: '8%', top: '15%', containLabel: true },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            // 修复：空数据时显示默认值，避免ECharts报错
            data: window.chartData.time.length > 0 ? window.chartData.time : ['暂无数据'],
            axisLabel: { interval: 0, rotate: 15, fontSize: 12 }
        },
        yAxis: { type: 'value', min: 0, max: 100 }, // 湿度最大100，合理
        series: [
            { 
                name: '温度(℃)', 
                type: 'line', 
                smooth: true, 
                data: window.chartData.temperature.length > 0 ? window.chartData.temperature : [0],
                lineStyle: { width: 2, color: '#42b983' } // 自定义颜色
            },
            { 
                name: '湿度(%)', 
                type: 'line', 
                smooth: true, 
                data: window.chartData.humidity.length > 0 ? window.chartData.humidity : [0],
                lineStyle: { width: 2, color: '#3498db' }
            },
            { 
                name: '风速(m/s)', 
                type: 'line', 
                smooth: true, 
                data: window.chartData.windSpeed.length > 0 ? window.chartData.windSpeed : [0],
                lineStyle: { width: 2, color: '#9b59b6' }
            }
        ],
        animationDuration: 1000
    };
    mainChart.setOption(mainOption);

    // 2. 光照图表（保留smooth/lineStyle/areaStyle）
    lightChart = echarts.init(lightChartDom);
    const lightOption = {
        title: { text: '光照强度趋势' },
        tooltip: { trigger: 'axis' },
        legend: { data: ['光照(lux)'], top: 10 },
        grid: { left: '3%', right: '3%', bottom: '8%', top: '15%', containLabel: true },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            // 修复：空数据时显示默认值
            data: window.chartData.time.length > 0 ? window.chartData.time : ['暂无数据'],
            axisLabel: { interval: 0, rotate: 15, fontSize: 12 }
        },
        yAxis: { type: 'value', min: 0 }, // 自动适配光照数据
        series: [
            { 
                name: '光照(lux)', 
                type: 'line', 
                smooth: true, 
                data: window.chartData.illumination.length > 0 ? window.chartData.illumination : [0],
                lineStyle: { width: 2, color: '#e74c3c' },
                areaStyle: { color: 'rgba(231,76,60,0.1)' }, // 保留面积样式
                emphasis: { focus: 'series' } // 优化交互
            }
        ],
        animationDuration: 1000
    };
    lightChart.setOption(lightOption);

    // 窗口缩放自适应
    window.addEventListener('resize', () => {
        if (mainChart) mainChart.resize();
        if (lightChart) lightChart.resize();
    });

    console.log('图表初始化完成（非极简版，保留所有样式）');
};

// 数据更新（强制触发y轴重计算+保留样式）
window.updateChartData = function(data) {
    if (!mainChart || !lightChart) {
        console.warn('图表未初始化，跳过更新');
        return;
    }

    const now = new Date().toLocaleTimeString();
    // 追加新数据
    window.chartData.time.push(now);
    window.chartData.temperature.push(data.temperature || 0);
    window.chartData.humidity.push(data.humidity || 0);
    window.chartData.windSpeed.push(data.windSpeed || 0);
    window.chartData.illumination.push(data.illumination || 0);

    // 保留最近20条数据
    if (window.chartData.time.length > 20) {
        Object.keys(window.chartData).forEach(key => window.chartData[key].shift());
    }

    // 强制更新图表（保留原有样式，仅更新数据）
    mainChart.setOption({
        xAxis: { data: window.chartData.time },
        series: [
            { data: window.chartData.temperature },
            { data: window.chartData.humidity },
            { data: window.chartData.windSpeed }
        ]
    });

    lightChart.setOption({
        xAxis: { data: window.chartData.time },
        series: [{ data: window.chartData.illumination }]
    });

    // 触发图表重绘+自适应
    mainChart.resize();
    lightChart.resize();
    console.log('图表数据更新完成：', data);
};