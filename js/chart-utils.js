// 全局图表数据
window.chartData = {
    time: [],
    temperature: [],
    humidity: [],
    windSpeed: [],
    illumination: []
};
// 全局图表实例
let mainChart, lightChart;

// 初始化图表（移动端适配+保留所有样式）
window.initCharts = function() {
    const mainChartDom = document.getElementById('main-chart');
    const lightChartDom = document.getElementById('light-chart');
    
    // 验证容器存在
    if (!mainChartDom || !lightChartDom) {
        console.error('❌ 图表容器未找到！');
        return;
    }

    // 检测是否为移动端（用于适配）
    const isMobile = window.innerWidth <= 768;

    // 1. 温/湿/风 图表初始化
    mainChart = echarts.init(mainChartDom);
    const mainOption = {
        title: { 
            text: '温/湿/风 趋势', 
            fontSize: isMobile ? 14 : 16 // 移动端缩小标题
        },
        tooltip: { trigger: 'axis' },
        legend: { 
            data: ['温度(℃)', '湿度(%)', '风速(m/s)'], 
            top: 10,
            fontSize: isMobile ? 12 : 14 // 移动端缩小图例
        },
        grid: { 
            left: '5%', 
            right: '5%', 
            bottom: '12%', // 移动端增加底部边距，避免标签遮挡
            top: '18%',
            containLabel: true 
        },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            // 空数据时显示默认值，避免报错
            data: window.chartData.time.length > 0 ? window.chartData.time : ['暂无数据'],
            axisLabel: { 
                interval: 0, 
                rotate: isMobile ? 20 : 15, // 移动端增加旋转角度
                fontSize: isMobile ? 10 : 12
            }
        },
        yAxis: { 
            type: 'value', 
            min: 0, 
            max: 100,
            axisLabel: { fontSize: isMobile ? 10 : 12 }
        },
        series: [
            { 
                name: '温度(℃)', 
                type: 'line', 
                smooth: true, 
                data: window.chartData.temperature.length > 0 ? window.chartData.temperature : [0],
                lineStyle: { width: 2, color: '#42b983' }
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

    // 2. 光照图表初始化
    lightChart = echarts.init(lightChartDom);
    const lightOption = {
        title: { 
            text: '光照强度趋势', 
            fontSize: isMobile ? 14 : 16 
        },
        tooltip: { trigger: 'axis' },
        legend: { 
            data: ['光照(lux)'], 
            top: 10,
            fontSize: isMobile ? 12 : 14 
        },
        grid: { 
            left: '5%', 
            right: '5%', 
            bottom: '12%',
            top: '18%',
            containLabel: true 
        },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            data: window.chartData.time.length > 0 ? window.chartData.time : ['暂无数据'],
            axisLabel: { 
                interval: 0, 
                rotate: isMobile ? 20 : 15,
                fontSize: isMobile ? 10 : 12
            }
        },
        yAxis: { 
            type: 'value', 
            min: 0,
            axisLabel: { fontSize: isMobile ? 10 : 12 }
        },
        series: [
            { 
                name: '光照(lux)', 
                type: 'line', 
                smooth: true, 
                data: window.chartData.illumination.length > 0 ? window.chartData.illumination : [0],
                lineStyle: { width: 2, color: '#e74c3c' },
                areaStyle: { color: 'rgba(231,76,60,0.1)' }, // 保留面积样式
                emphasis: { focus: 'series' } // 交互优化
            }
        ],
        animationDuration: 1000
    };
    lightChart.setOption(lightOption);

    // 移动端延迟resize，确保尺寸稳定
    setTimeout(() => {
        mainChart.resize();
        lightChart.resize();
    }, 100);

    console.log('✅ 图表初始化完成（移动端适配版）');
};

// 更新图表数据（保留最近20条）
window.updateChartData = function(data) {
    if (!mainChart || !lightChart) {
        console.warn('⚠️ 图表未初始化，跳过数据更新');
        return;
    }

    // 追加新数据
    const now = new Date().toLocaleTimeString();
    window.chartData.time.push(now);
    window.chartData.temperature.push(data.temperature || 0);
    window.chartData.humidity.push(data.humidity || 0);
    window.chartData.windSpeed.push(data.windSpeed || 0);
    window.chartData.illumination.push(data.illumination || 0);

    // 保留最近20条数据，避免数据过多
    if (window.chartData.time.length > 20) {
        Object.keys(window.chartData).forEach(key => window.chartData[key].shift());
    }

    // 强制更新图表数据
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

    // 触发图表重绘
    mainChart.resize();
    lightChart.resize();
    console.log('✅ 图表数据更新完成：', data);
};