/**
 * 环境数据图表工具（完整实现+清空数据功能）
 */
window.chartData = {
    time: [],
    temperature: [],
    humidity: [],
    windSpeed: [],
    illumination: []
};
let mainChart, lightChart;

// 初始化双图表
window.initCharts = function() {
    // 确保 echarts 库已加载
    if (typeof echarts === 'undefined') {
        console.error('❌ ECharts 库未加载！');
        setTimeout(window.initCharts, 200);
        return;
    }
    
    const mainChartDom = document.getElementById('main-chart');
    const lightChartDom = document.getElementById('light-chart');
    if (!mainChartDom || !lightChartDom) {
        console.error('❌ 图表容器未找到！');
        return;
    }

    const isMobile = window.innerWidth <= 768;
    const isLargeScreen = window.innerWidth >= 1440;

    // 温/湿/风图表配置
    mainChart = echarts.init(mainChartDom);
    const mainOption = {
        title: { 
            text: '温/湿/风 趋势', 
            left: 'center',
            top: '2%',
            textStyle: { 
                color: '#1f2937',
                fontSize: isLargeScreen ? 18 : (isMobile ? 15 : 17),
                fontWeight: 600,
                fontFamily: "Microsoft YaHei, PingFang SC"
            }
        },
        tooltip: { 
            trigger: 'axis',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            textStyle: { color: '#1f2937' },
            borderColor: '#e9ecef',
            borderWidth: 1
        },
        legend: { 
            data: ['温度(℃)', '湿度(%)', '风速(m/s)'], 
            top: '12%',
            left: 'center',
            textStyle: { 
                color: '#495057',
                fontSize: isLargeScreen ? 15 : (isMobile ? 13 : 14),
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
                fontSize: isLargeScreen ? 13 : (isMobile ? 11 : 12)
            },
            axisLine: { lineStyle: { color: '#dee2e6' } },
            axisTick: { lineStyle: { color: '#dee2e6' } }
        },
        yAxis: { 
            type: 'value', 
            min: 0, 
            max: 100,
            axisLabel: { 
                color: '#495057',
                fontSize: isLargeScreen ? 13 : (isMobile ? 11 : 12)
            },
            axisLine: { lineStyle: { color: '#dee2e6' } },
            axisTick: { lineStyle: { color: '#dee2e6' } },
            splitLine: { lineStyle: { color: '#f1f3f5' } }
        },
        series: [
            { 
                name: '温度(℃)', 
                type: 'line', 
                smooth: true, 
                data: window.chartData.temperature.length > 0 ? window.chartData.temperature : [0],
                lineStyle: { width: 2.5, color: '#42b983' },
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

    // 光照强度图表配置
    lightChart = echarts.init(lightChartDom);
    const lightOption = {
        title: { 
            text: '光照强度趋势', 
            left: 'center',
            top: '2%',
            textStyle: { 
                color: '#1f2937',
                fontSize: isLargeScreen ? 18 : (isMobile ? 15 : 17),
                fontWeight: 600
            }
        },
        tooltip: { 
            trigger: 'axis',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            textStyle: { color: '#1f2937' },
            borderColor: '#e9ecef',
            borderWidth: 1
        },
        legend: { 
            data: ['光照(lux)'], 
            top: '12%',
            left: 'center',
            textStyle: { 
                color: '#495057',
                fontSize: isLargeScreen ? 15 : (isMobile ? 13 : 14),
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
                fontSize: isLargeScreen ? 13 : (isMobile ? 11 : 12)
            },
            axisLine: { lineStyle: { color: '#dee2e6' } },
            axisTick: { lineStyle: { color: '#dee2e6' } }
        },
        yAxis: { 
            type: 'value', 
            min: 0,
            axisLabel: { 
                color: '#495057',
                fontSize: isLargeScreen ? 13 : (isMobile ? 11 : 12),
                formatter: '{value}'
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
                lineStyle: { width: 2.5, color: '#e74c3c' },
                areaStyle: { color: 'rgba(231,76,60,0.08)' },
                itemStyle: { color: '#e74c3c' },
                emphasis: { focus: 'series' }
            }
        ],
        animationDuration: 1000
    };
    lightChart.setOption(lightOption);

    // 自适应调整
    setTimeout(() => {
        mainChart.resize();
        lightChart.resize();
    }, 100);
    console.log('✅ 图表初始化完成');
};

// 更新图表数据（温/湿/风÷10）
window.updateChartData = function(data) {
    if (!mainChart || !lightChart) {
        console.warn('⚠️ 图表未初始化，跳过更新');
        return;
    }

    const now = new Date().toLocaleTimeString();
    window.chartData.time.push(now);
    
    // 核心：温/湿/风÷10保留1位小数
    const temp = data.temperature !== undefined && data.temperature !== null 
        ? (parseFloat(data.temperature)/10).toFixed(1) 
        : 0;
    window.chartData.temperature.push(temp);

    // 简化版 - 对所有字段统一处理
    window.chartData.temperature.push(
        data.temperature !== undefined && data.temperature !== null 
            ? parseFloat(data.temperature / 10).toFixed(1) 
            : 0
    );
    window.chartData.humidity.push(
        data.humidity !== undefined && data.humidity !== null 
            ? parseFloat(data.humidity / 10).toFixed(1) 
            : 0
    );
    window.chartData.windSpeed.push(
        data.windSpeed !== undefined && data.windSpeed !== null 
            ? parseFloat(data.windSpeed / 10).toFixed(1) 
            : 0
    );
    window.chartData.illumination.push(
        data.illumination !== undefined && data.illumination !== null 
            ? parseInt(data.illumination) 
            : 0
    );

    // 保留最近20条数据
    if (window.chartData.time.length > 20) {
        Object.keys(window.chartData).forEach(key => window.chartData[key].shift());
    }

    // 更新图表
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

    mainChart.resize();
    lightChart.resize();
};

// 清空图表数据（完整实现）
window.clearChartData = function() {
    window.chartData = {
        time: [],
        temperature: [],
        humidity: [],
        windSpeed: [],
        illumination: []
    };
    
    // 重置图表显示
    if (mainChart) {
        mainChart.setOption({
            xAxis: { data: ['暂无数据'] },
            series: [
                { data: [0] },
                { data: [0] },
                { data: [0] }
            ]
        });
    }
    
    if (lightChart) {
        lightChart.setOption({
            xAxis: { data: ['暂无数据'] },
            series: [{ data: [0] }]
        });
    }
    
    // 重置数据卡片
    if (typeof updateDataValue === 'function') {
        updateDataValue('temperature', 0);
        updateDataValue('humidity', 0);
        updateDataValue('windSpeed', 0);
        updateDataValue('illumination', 0);
    }
};

// 页面加载初始化由 main-utils.js 在 load 事件中统一管理
// 避免重复初始化

// 窗口大小变化时自适应图表
window.addEventListener('resize', () => {
    if (mainChart) mainChart.resize();
    if (lightChart) lightChart.resize();
});