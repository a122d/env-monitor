// 图表数据与实例
window.chartData = {
    time: [],
    temperature: [],
    humidity: [],
    windSpeed: [],
    illumination: []
};

let tempChart, humidityChart, windChart, lightChart;

// 获取响应式配置
function getResponsiveConfig() {
    const width = window.innerWidth;
    const isMobile = width <= 767;
    const isTablet = width > 767 && width <= 1023;
    const isLargeScreen = width >= 1440;
    
    return {
        isMobile,
        isTablet,
        isLargeScreen,
        fontSize: {
            title: isLargeScreen ? 18 : (isMobile ? 14 : 16),
            axis: isLargeScreen ? 13 : (isMobile ? 10 : 12),
            tooltip: isMobile ? 12 : 13
        },
        grid: {
            left: isMobile ? '12%' : '8%',
            right: isMobile ? '8%' : '8%',
            bottom: isMobile ? '18%' : '15%',
            top: isMobile ? '15%' : '18%'
        },
        symbolSize: isMobile ? 4 : 6,
        lineWidth: isMobile ? 2 : 3,
        rotate: isMobile ? 45 : 30
    };
}

// 初始化四个独立图表
window.initCharts = function() {
    if (typeof echarts === 'undefined') {
        console.error('❌ ECharts 库未加载！');
        setTimeout(window.initCharts, 200);
        return;
    }

    const tempDom = document.getElementById('temp-chart');
    const humidityDom = document.getElementById('humidity-chart');
    const windDom = document.getElementById('wind-chart');
    const lightDom = document.getElementById('light-chart');

    if (!tempDom || !humidityDom || !windDom || !lightDom) {
        console.error('❌ 图表容器未找到！');
        return;
    }

    const config = getResponsiveConfig();

    const common = {
        tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(255, 255, 255, 0.96)',
            textStyle: { 
                color: '#1f2937',
                fontSize: config.fontSize.tooltip,
                fontWeight: 500
            },
            borderColor: 'rgba(37, 99, 235, 0.2)',
            borderWidth: 1,
            padding: config.isMobile ? [8, 12] : [10, 15],
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.1)',
            shadowOffsetX: 0,
            shadowOffsetY: 2,
            extraCssText: 'border-radius: 8px; backdrop-filter: blur(10px);',
            confine: true
        },
        grid: {
            left: config.grid.left,
            right: config.grid.right,
            bottom: config.grid.bottom,
            top: config.grid.top,
            containLabel: true
        },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            data: window.chartData.time.length > 0 ? window.chartData.time : ['暂无数据'],
            axisLabel: {
                interval: 0,
                rotate: config.rotate,
                color: '#64748b',
                fontSize: config.fontSize.axis,
                fontWeight: 500,
                hideOverlap: true
            },
            axisLine: { 
                lineStyle: { 
                    color: '#e2e8f0',
                    width: 1.5
                } 
            },
            axisTick: { 
                lineStyle: { 
                    color: '#e2e8f0' 
                } 
            },
            splitLine: {
                show: false
            }
        },
        animationDuration: 800,
        animationEasing: 'cubicOut'
    };

    // 温度图
    tempChart = echarts.init(tempDom);
    tempChart.setOption({
        title: {
            text: '温度趋势 (℃)',
            left: 'center',
            top: '3%',
            textStyle: {
                color: '#1f2937',
                fontSize: config.fontSize.title,
                fontWeight: 700,
                letterSpacing: 0.5
            },
            subtextStyle: {
                color: '#64748b',
                fontSize: 12
            }
        },
        tooltip: common.tooltip,
        grid: common.grid,
        xAxis: common.xAxis,
        yAxis: {
            type: 'value',
            min: -10,
            max: 50,
            axisLabel: {
                color: '#64748b',
                fontSize: config.fontSize.axis,
                fontWeight: 500,
                formatter: '{value}°'
            },
            axisLine: { 
                lineStyle: { 
                    color: '#e2e8f0',
                    width: 1.5
                } 
            },
            splitLine: { 
                lineStyle: { 
                    color: '#f1f5f9',
                    type: 'dashed'
                } 
            }
        },
        series: [{
            name: '温度(℃)',
            type: 'line',
            smooth: true,
            smoothMonotone: 'x',
            symbol: 'circle',
            symbolSize: config.symbolSize,
            data: window.chartData.temperature.length ? window.chartData.temperature : [0],
            lineStyle: { 
                width: config.lineWidth,
                color: {
                    type: 'linear',
                    x: 0, y: 0, x2: 1, y2: 0,
                    colorStops: [
                        { offset: 0, color: '#f97316' },
                        { offset: 0.5, color: '#ef4444' },
                        { offset: 1, color: '#dc2626' }
                    ]
                },
                shadowColor: 'rgba(239, 68, 68, 0.3)',
                shadowBlur: 8,
                shadowOffsetY: 3
            },
            itemStyle: { 
                color: '#ef4444',
                borderColor: '#fff',
                borderWidth: 2,
                shadowColor: 'rgba(239, 68, 68, 0.4)',
                shadowBlur: 6
            },
            areaStyle: { 
                color: {
                    type: 'linear',
                    x: 0, y: 0, x2: 0, y2: 1,
                    colorStops: [
                        { offset: 0, color: 'rgba(239, 68, 68, 0.25)' },
                        { offset: 0.5, color: 'rgba(239, 68, 68, 0.1)' },
                        { offset: 1, color: 'rgba(239, 68, 68, 0.02)' }
                    ]
                }
            },
            emphasis: {
                focus: 'series',
                itemStyle: {
                    borderWidth: 3,
                    shadowBlur: 10,
                    shadowColor: 'rgba(239, 68, 68, 0.6)'
                }
            }
        }]
    });

    // 湿度图
    humidityChart = echarts.init(humidityDom);
    humidityChart.setOption({
        title: {
            text: '湿度趋势 (%)',
            left: 'center',
            top: '3%',
            textStyle: {
                color: '#1f2937',
                fontSize: config.fontSize.title,
                fontWeight: 700,
                letterSpacing: 0.5
            }
        },
        tooltip: common.tooltip,
        grid: common.grid,
        xAxis: common.xAxis,
        yAxis: {
            type: 'value',
            min: 0,
            max: 100,
            axisLabel: {
                color: '#64748b',
                fontSize: config.fontSize.axis,
                fontWeight: 500,
                formatter: '{value}%'
            },
            axisLine: { 
                lineStyle: { 
                    color: '#e2e8f0',
                    width: 1.5
                } 
            },
            splitLine: { 
                lineStyle: { 
                    color: '#f1f5f9',
                    type: 'dashed'
                } 
            }
        },
        series: [{
            name: '湿度(%)',
            type: 'line',
            smooth: true,
            smoothMonotone: 'x',
            symbol: 'circle',
            symbolSize: config.symbolSize,
            data: window.chartData.humidity.length ? window.chartData.humidity : [0],
            lineStyle: { 
                width: config.lineWidth,
                color: {
                    type: 'linear',
                    x: 0, y: 0, x2: 1, y2: 0,
                    colorStops: [
                        { offset: 0, color: '#06b6d4' },
                        { offset: 0.5, color: '#0891b2' },
                        { offset: 1, color: '#0e7490' }
                    ]
                },
                shadowColor: 'rgba(8, 145, 178, 0.3)',
                shadowBlur: 8,
                shadowOffsetY: 3
            },
            itemStyle: { 
                color: '#0891b2',
                borderColor: '#fff',
                borderWidth: 2,
                shadowColor: 'rgba(8, 145, 178, 0.4)',
                shadowBlur: 6
            },
            areaStyle: { 
                color: {
                    type: 'linear',
                    x: 0, y: 0, x2: 0, y2: 1,
                    colorStops: [
                        { offset: 0, color: 'rgba(6, 182, 212, 0.25)' },
                        { offset: 0.5, color: 'rgba(6, 182, 212, 0.1)' },
                        { offset: 1, color: 'rgba(6, 182, 212, 0.02)' }
                    ]
                }
            },
            emphasis: {
                focus: 'series',
                itemStyle: {
                    borderWidth: 3,
                    shadowBlur: 10,
                    shadowColor: 'rgba(8, 145, 178, 0.6)'
                }
            }
        }]
    });

    // 风速图
    windChart = echarts.init(windDom);
    windChart.setOption({
        title: {
            text: '风速趋势 (m/s)',
            left: 'center',
            top: '3%',
            textStyle: {
                color: '#1f2937',
                fontSize: config.fontSize.title,
                fontWeight: 700,
                letterSpacing: 0.5
            }
        },
        tooltip: common.tooltip,
        grid: common.grid,
        xAxis: common.xAxis,
        yAxis: {
            type: 'value',
            min: 0,
            max: 20,
            axisLabel: {
                color: '#64748b',
                fontSize: config.fontSize.axis,
                fontWeight: 500,
                formatter: '{value}m/s'
            },
            axisLine: { 
                lineStyle: { 
                    color: '#e2e8f0',
                    width: 1.5
                } 
            },
            splitLine: { 
                lineStyle: { 
                    color: '#f1f5f9',
                    type: 'dashed'
                } 
            }
        },
        series: [{
            name: '风速(m/s)',
            type: 'line',
            smooth: true,
            smoothMonotone: 'x',
            symbol: 'circle',
            symbolSize: config.symbolSize,
            data: window.chartData.windSpeed.length ? window.chartData.windSpeed : [0],
            lineStyle: { 
                width: config.lineWidth,
                color: {
                    type: 'linear',
                    x: 0, y: 0, x2: 1, y2: 0,
                    colorStops: [
                        { offset: 0, color: '#a78bfa' },
                        { offset: 0.5, color: '#8b5cf6' },
                        { offset: 1, color: '#7c3aed' }
                    ]
                },
                shadowColor: 'rgba(139, 92, 246, 0.3)',
                shadowBlur: 8,
                shadowOffsetY: 3
            },
            itemStyle: { 
                color: '#8b5cf6',
                borderColor: '#fff',
                borderWidth: 2,
                shadowColor: 'rgba(139, 92, 246, 0.4)',
                shadowBlur: 6
            },
            areaStyle: { 
                color: {
                    type: 'linear',
                    x: 0, y: 0, x2: 0, y2: 1,
                    colorStops: [
                        { offset: 0, color: 'rgba(139, 92, 246, 0.25)' },
                        { offset: 0.5, color: 'rgba(139, 92, 246, 0.1)' },
                        { offset: 1, color: 'rgba(139, 92, 246, 0.02)' }
                    ]
                }
            },
            emphasis: {
                focus: 'series',
                itemStyle: {
                    borderWidth: 3,
                    shadowBlur: 10,
                    shadowColor: 'rgba(139, 92, 246, 0.6)'
                }
            }
        }]
    });

    // 光照图
    lightChart = echarts.init(lightDom);
    lightChart.setOption({
        title: {
            text: '光照强度趋势 (lux)',
            left: 'center',
            top: '3%',
            textStyle: {
                color: '#1f2937',
                fontSize: config.fontSize.title,
                fontWeight: 700,
                letterSpacing: 0.5
            }
        },
        tooltip: common.tooltip,
        grid: common.grid,
        xAxis: common.xAxis,
        yAxis: {
            type: 'value',
            min: 0,
            axisLabel: {
                color: '#64748b',
                fontSize: config.fontSize.axis,
                fontWeight: 500,
                formatter: '{value}'
            },
            axisLine: { 
                lineStyle: { 
                    color: '#e2e8f0',
                    width: 1.5
                } 
            },
            splitLine: { 
                lineStyle: { 
                    color: '#f1f5f9',
                    type: 'dashed'
                } 
            }
        },
        series: [{
            name: '光照(lux)',
            type: 'line',
            smooth: true,
            smoothMonotone: 'x',
            symbol: 'circle',
            symbolSize: config.symbolSize,
            data: window.chartData.illumination.length ? window.chartData.illumination : [0],
            lineStyle: { 
                width: config.lineWidth,
                color: {
                    type: 'linear',
                    x: 0, y: 0, x2: 1, y2: 0,
                    colorStops: [
                        { offset: 0, color: '#fbbf24' },
                        { offset: 0.5, color: '#f59e0b' },
                        { offset: 1, color: '#d97706' }
                    ]
                },
                shadowColor: 'rgba(245, 158, 11, 0.3)',
                shadowBlur: 8,
                shadowOffsetY: 3
            },
            itemStyle: { 
                color: '#f59e0b',
                borderColor: '#fff',
                borderWidth: 2,
                shadowColor: 'rgba(245, 158, 11, 0.4)',
                shadowBlur: 6
            },
            areaStyle: { 
                color: {
                    type: 'linear',
                    x: 0, y: 0, x2: 0, y2: 1,
                    colorStops: [
                        { offset: 0, color: 'rgba(251, 191, 36, 0.25)' },
                        { offset: 0.5, color: 'rgba(251, 191, 36, 0.1)' },
                        { offset: 1, color: 'rgba(251, 191, 36, 0.02)' }
                    ]
                }
            },
            emphasis: {
                focus: 'series',
                itemStyle: {
                    borderWidth: 3,
                    shadowBlur: 10,
                    shadowColor: 'rgba(245, 158, 11, 0.6)'
                }
            }
        }]
    });

    window.tempChart = tempChart;
    window.humidityChart = humidityChart;
    window.windChart = windChart;
    window.lightChart = lightChart;

    setTimeout(() => {
        tempChart.resize();
        humidityChart.resize();
        windChart.resize();
        lightChart.resize();
    }, 100);
    console.log('✅ 四图表初始化完成');
};

// 更新四个图表数据
window.updateChartData = function(data) {
    if (!tempChart || !humidityChart || !windChart || !lightChart) {
        console.warn('⚠️ 图表未初始化，跳过更新');
        return;
    }

    const now = new Date().toLocaleTimeString();
    window.chartData.time.push(now);

    const tempVal = data.temperature !== undefined && data.temperature !== null
        ? parseFloat(parseFloat(data.temperature) / 10).toFixed(1)
        : '0';
    const humVal = data.humidity !== undefined && data.humidity !== null
        ? parseFloat(parseFloat(data.humidity) / 10).toFixed(1)
        : '0';
    const windVal = data.windSpeed !== undefined && data.windSpeed !== null
        ? parseFloat(parseFloat(data.windSpeed) / 10).toFixed(1)
        : '0';
    const lightVal = data.illumination !== undefined && data.illumination !== null
        ? parseInt(data.illumination)
        : 0;

    window.chartData.temperature.push(Number(tempVal));
    window.chartData.humidity.push(Number(humVal));
    window.chartData.windSpeed.push(Number(windVal));
    window.chartData.illumination.push(lightVal);

    // 保留最近20条数据
    const maxLen = 20;
    if (window.chartData.time.length > maxLen) {
        Object.keys(window.chartData).forEach(key => window.chartData[key].shift());
    }

    const xData = window.chartData.time;

    tempChart.setOption({
        xAxis: { data: xData },
        series: [{ data: window.chartData.temperature }]
    });

    humidityChart.setOption({
        xAxis: { data: xData },
        series: [{ data: window.chartData.humidity }]
    });

    windChart.setOption({
        xAxis: { data: xData },
        series: [{ data: window.chartData.windSpeed }]
    });

    lightChart.setOption({
        xAxis: { data: xData },
        series: [{ data: window.chartData.illumination }]
    });
};

// 清空图表数据
window.clearChartData = function() {
    window.chartData = {
        time: [],
        temperature: [],
        humidity: [],
        windSpeed: [],
        illumination: []
    };

    const emptyXAxis = ['暂无数据'];

    if (tempChart) {
        tempChart.setOption({
            xAxis: { data: emptyXAxis },
            series: [{ data: [0] }]
        });
    }

    if (humidityChart) {
        humidityChart.setOption({
            xAxis: { data: emptyXAxis },
            series: [{ data: [0] }]
        });
    }

    if (windChart) {
        windChart.setOption({
            xAxis: { data: emptyXAxis },
            series: [{ data: [0] }]
        });
    }

    if (lightChart) {
        lightChart.setOption({
            xAxis: { data: emptyXAxis },
            series: [{ data: [0] }]
        });
    }

    if (typeof window.updateDataValue === 'function') {
        window.updateDataValue('temperature', 0);
        window.updateDataValue('humidity', 0);
        window.updateDataValue('windSpeed', 0);
        window.updateDataValue('illumination', 0);
    }
};