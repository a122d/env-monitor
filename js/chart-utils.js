window.chartData = {
    time: [],
    temperature: [],
    humidity: [],
    windSpeed: [],
    illumination: []
};
let mainChart, lightChart;

window.initCharts = function() {
    const mainChartDom = document.getElementById('main-chart');
    const lightChartDom = document.getElementById('light-chart');
    if (!mainChartDom || !lightChartDom) {
        console.error('❌ 图表容器未找到！');
        return;
    }

    const isMobile = window.innerWidth <= 768;

    // 1. 温/湿/风 图表（浅色主题+修复重叠）
    mainChart = echarts.init(mainChartDom);
    const mainOption = {
        // 标题：调整位置+深黑文字
        title: { 
            text: '温/湿/风 趋势', 
            left: 'center',
            top: '2%', // 标题上移，留出更多空间
            textStyle: { 
                color: '#212121', // 标题深黑
                fontSize: isMobile ? 15 : 17,
                fontWeight: 600
            }
        },
        // 提示框：浅色背景+深黑文字
        tooltip: { 
            trigger: 'axis',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            textStyle: { color: '#212121' },
            borderColor: '#e9ecef',
            borderWidth: 1
        },
        // 图例：下移+深灰文字，避免和标题重叠
        legend: { 
            data: ['温度(℃)', '湿度(%)', '风速(m/s)'], 
            top: '12%', // 图例下移，和标题错开
            left: 'center',
            textStyle: { 
                color: '#495057', // 图例中深灰
                fontSize: isMobile ? 13 : 14,
                fontWeight: 500
            }
        },
        // 网格：大幅上移，给标题/图例留足空间
        grid: { 
            left: '6%', 
            right: '6%', 
            bottom: '18%', // 底部留空间给x轴标签
            top: '22%',    // 顶部留空间给标题/图例
            containLabel: true 
        },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            data: window.chartData.time.length > 0 ? window.chartData.time : ['暂无数据'],
            axisLabel: { 
                interval: 0, 
                rotate: isMobile ? 25 : 15, // 增大旋转角度，避免标签重叠
                color: '#495057', // 轴标签中深灰
                fontSize: isMobile ? 11 : 12
            },
            axisLine: { lineStyle: { color: '#dee2e6' } }, // 轴线条浅灰
            axisTick: { lineStyle: { color: '#dee2e6' } }
        },
        yAxis: { 
            type: 'value', 
            min: 0, 
            max: 100,
            axisLabel: { 
                color: '#495057',
                fontSize: isMobile ? 11 : 12
            },
            axisLine: { lineStyle: { color: '#dee2e6' } },
            axisTick: { lineStyle: { color: '#dee2e6' } },
            splitLine: { lineStyle: { color: '#f1f3f5' } } // 网格线浅灰
        },
        series: [
            { 
                name: '温度(℃)', 
                type: 'line', 
                smooth: true, 
                data: window.chartData.temperature.length > 0 ? window.chartData.temperature : [0],
                lineStyle: { width: 2.5, color: '#42b983' }, // 加粗线条，提升对比
                itemStyle: { color: '#42b983' }
            },
            { 
                name: '湿度(%)', 
                type: 'line', 
                smooth: true, 
                data: window.chartData.humidity.length > 0 ? window.chartData.humidity : [0],
                lineStyle: { width: 2.5, color: '#3498db' },
                itemStyle: { color: '#3498db' }
            },
            { 
                name: '风速(m/s)', 
                type: 'line', 
                smooth: true, 
                data: window.chartData.windSpeed.length > 0 ? window.chartData.windSpeed : [0],
                lineStyle: { width: 2.5, color: '#9b59b6' },
                itemStyle: { color: '#9b59b6' }
            }
        ],
        animationDuration: 1000
    };
    mainChart.setOption(mainOption);

    // 2. 光照图表（同逻辑修复）
    lightChart = echarts.init(lightChartDom);
    const lightOption = {
        title: { 
            text: '光照强度趋势', 
            left: 'center',
            top: '2%',
            textStyle: { 
                color: '#212121',
                fontSize: isMobile ? 15 : 17,
                fontWeight: 600
            }
        },
        tooltip: { 
            trigger: 'axis',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            textStyle: { color: '#212121' },
            borderColor: '#e9ecef',
            borderWidth: 1
        },
        legend: { 
            data: ['光照(lux)'], 
            top: '12%',
            left: 'center',
            textStyle: { 
                color: '#495057',
                fontSize: isMobile ? 13 : 14,
                fontWeight: 500
            }
        },
        grid: { 
            left: '6%', 
            right: '6%', 
            bottom: '18%',
            top: '22%',
            containLabel: true 
        },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            data: window.chartData.time.length > 0 ? window.chartData.time : ['暂无数据'],
            axisLabel: { 
                interval: 0, 
                rotate: isMobile ? 25 : 15,
                color: '#495057',
                fontSize: isMobile ? 11 : 12
            },
            axisLine: { lineStyle: { color: '#dee2e6' } },
            axisTick: { lineStyle: { color: '#dee2e6' } }
        },
        yAxis: { 
            type: 'value', 
            min: 0,
            axisLabel: { 
                color: '#495057',
                fontSize: isMobile ? 11 : 12
            },
            axisLine: { lineStyle: { color: '#dee2e6' } },
            axisTick: { lineStyle: { color: '#dee2e6' } },
            splitLine: { lineStyle: { color: '#f1f3f5' } }
        },
        series: [
            { 
                name: '光照(lux)', 
                type: 'line', 
                smooth: true, 
                data: window.chartData.illumination.length > 0 ? window.chartData.illumination : [0],
                lineStyle: { width: 2.5, color: '#e74c3c' }, // 加粗线条
                areaStyle: { color: 'rgba(231,76,60,0.08)' }, // 浅色面积，不刺眼
                itemStyle: { color: '#e74c3c' },
                emphasis: { focus: 'series' }
            }
        ],
        animationDuration: 1000
    };
    lightChart.setOption(lightOption);

    // 强制resize，确保尺寸正确
    setTimeout(() => {
        mainChart.resize();
        lightChart.resize();
    }, 100);
    console.log('✅ 图表初始化完成（浅色高对比版）');
};

// 数据更新逻辑不变，保留容错
window.updateChartData = function(data) {
    if (!mainChart || !lightChart) {
        console.warn('⚠️ 图表未初始化，跳过更新');
        return;
    }

    const now = new Date().toLocaleTimeString();
    window.chartData.time.push(now);
    window.chartData.temperature.push(data.temperature || 0);
    window.chartData.humidity.push(data.humidity || 0);
    window.chartData.windSpeed.push(data.windSpeed || 0);
    window.chartData.illumination.push(data.illumination || 0);

    // 保留最近20条数据，避免数据过多导致标签重叠
    if (window.chartData.time.length > 20) {
        Object.keys(window.chartData).forEach(key => window.chartData[key].shift());
    }

    // 更新图表数据
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

    // 触发重绘，确保布局正确
    mainChart.resize();
    lightChart.resize();
};