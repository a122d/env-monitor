// 图表数据与实例
window.chartData = {
    time: [],
    temperature: [],
    humidity: [],
    windSpeed: [],
    illumination: [],
    PM2: [],
    sunray: []
};

let tempChart, humidityChart, windChart, lightChart, PM2Chart, sunrayChart;
// 全局控制
window.chartRealtimePaused = false;
window.CHART_MAX_LEN = 20; // 实时视图默认保留点数
window.CHART_HISTORY_LEN = 240; // 历史视图保留点数（可切换）

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
            left: isMobile ? '4%' : '3%',
            right: isMobile ? '8%' : '8%',
            bottom: isMobile ? '6%' : '5%',
            top: isMobile ? '24%' : '18%'
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
    const PM2Dom = document.getElementById('pm25-chart');
    const sunrayDom = document.getElementById('sunray-chart');

    if (!tempDom || !humidityDom || !windDom || !lightDom || !PM2Dom || !sunrayDom) {
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

    // 添加 dataZoom 到 common 配置，方便用户缩放查看历史数据
    common.dataZoom = [
        {
            type: 'slider',
            show: true,
            start: 0,
            end: 100,
            bottom: config.isMobile ? '0%' : '2%'
        },
        {
            type: 'inside',
            start: 0,
            end: 100
        }
    ];

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
    // 在每个图表选项中启用 dataZoom 支持
    tempChart.setOption({ dataZoom: common.dataZoom });

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
    humidityChart.setOption({ dataZoom: common.dataZoom });

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
    windChart.setOption({ dataZoom: common.dataZoom });

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
    lightChart.setOption({ dataZoom: common.dataZoom });

    // PM2.5图
    PM2Chart = echarts.init(PM2Dom);
    PM2Chart.setOption({
        title: {
            text: 'PM2.5趋势 (μg/m³)',
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
            name: 'PM2.5(μg/m³)',
            type: 'line',
            smooth: true,
            smoothMonotone: 'x',
            symbol: 'circle',
            symbolSize: config.symbolSize,
            data: window.chartData.PM2.length ? window.chartData.PM2 : [0],
            lineStyle: { 
                width: config.lineWidth,
                color: {
                    type: 'linear',
                    x: 0, y: 0, x2: 1, y2: 0,
                    colorStops: [
                        { offset: 0, color: '#10b981' },
                        { offset: 0.5, color: '#059669' },
                        { offset: 1, color: '#047857' }
                    ]
                },
                shadowColor: 'rgba(16, 185, 129, 0.3)',
                shadowBlur: 8,
                shadowOffsetY: 3
            },
            itemStyle: { 
                color: '#059669',
                borderColor: '#fff',
                borderWidth: 2,
                shadowColor: 'rgba(16, 185, 129, 0.4)',
                shadowBlur: 6
            },
            areaStyle: { 
                color: {
                    type: 'linear',
                    x: 0, y: 0, x2: 0, y2: 1,
                    colorStops: [
                        { offset: 0, color: 'rgba(16, 185, 129, 0.25)' },
                        { offset: 0.5, color: 'rgba(16, 185, 129, 0.1)' },
                        { offset: 1, color: 'rgba(16, 185, 129, 0.02)' }
                    ]
                }
            },
            emphasis: {
                focus: 'series',
                itemStyle: {
                    borderWidth: 3,
                    shadowBlur: 10,
                    shadowColor: 'rgba(16, 185, 129, 0.6)'
                }
            }
        }]
    });
    PM2Chart.setOption({ dataZoom: common.dataZoom });

    // 紫外线强度图
    sunrayChart = echarts.init(sunrayDom);
    sunrayChart.setOption({
        title: {
            text: '紫外线强度趋势 (UVI)',
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
            max: 16,
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
            name: '紫外线(UVI)',
            type: 'line',
            smooth: true,
            smoothMonotone: 'x',
            symbol: 'circle',
            symbolSize: config.symbolSize,
            data: window.chartData.sunray.length ? window.chartData.sunray : [0],
            lineStyle: { 
                width: config.lineWidth,
                color: {
                    type: 'linear',
                    x: 0, y: 0, x2: 1, y2: 0,
                    colorStops: [
                        { offset: 0, color: '#ec4899' },
                        { offset: 0.5, color: '#db2777' },
                        { offset: 1, color: '#be185d' }
                    ]
                },
                shadowColor: 'rgba(236, 72, 153, 0.3)',
                shadowBlur: 8,
                shadowOffsetY: 3
            },
            itemStyle: { 
                color: '#db2777',
                borderColor: '#fff',
                borderWidth: 2,
                shadowColor: 'rgba(236, 72, 153, 0.4)',
                shadowBlur: 6
            },
            areaStyle: { 
                color: {
                    type: 'linear',
                    x: 0, y: 0, x2: 0, y2: 1,
                    colorStops: [
                        { offset: 0, color: 'rgba(236, 72, 153, 0.25)' },
                        { offset: 0.5, color: 'rgba(236, 72, 153, 0.1)' },
                        { offset: 1, color: 'rgba(236, 72, 153, 0.02)' }
                    ]
                }
            },
            emphasis: {
                focus: 'series',
                itemStyle: {
                    borderWidth: 3,
                    shadowBlur: 10,
                    shadowColor: 'rgba(236, 72, 153, 0.6)'
                }
            }
        }]
    });
    sunrayChart.setOption({ dataZoom: common.dataZoom });

    window.tempChart = tempChart;
    window.humidityChart = humidityChart;
    window.windChart = windChart;
    window.lightChart = lightChart;
    window.PM2Chart = PM2Chart;
    window.sunrayChart = sunrayChart;

    setTimeout(() => {
        tempChart.resize();
        humidityChart.resize();
        windChart.resize();
        lightChart.resize();
        PM2Chart.resize();
        sunrayChart.resize();
    }, 100);
    console.log('✅ 六图表初始化完成');
};

// 图表更新队列和RAF优化
let chartUpdatePending = false;
let lastChartUpdate = 0;
const CHART_UPDATE_THROTTLE = 500; // 限制更新频率为500ms一次

// 批量更新所有图表（使用RAF优化）
function batchUpdateCharts() {
    if (!tempChart || !humidityChart || !windChart || !lightChart || !PM2Chart || !sunrayChart) {
        return;
    }
    
    const xData = window.chartData.time;
    
    // 使用requestAnimationFrame确保在下一帧渲染
    requestAnimationFrame(() => {
        // 批量更新，使用notMerge: false实现增量更新，提高性能
        tempChart.setOption({
            xAxis: { data: xData },
            series: [{ data: window.chartData.temperature }]
        }, { notMerge: false, lazyUpdate: true });
        
        humidityChart.setOption({
            xAxis: { data: xData },
            series: [{ data: window.chartData.humidity }]
        }, { notMerge: false, lazyUpdate: true });
        
        windChart.setOption({
            xAxis: { data: xData },
            series: [{ data: window.chartData.windSpeed }]
        }, { notMerge: false, lazyUpdate: true });
        
        lightChart.setOption({
            xAxis: { data: xData },
            series: [{ data: window.chartData.illumination }]
        }, { notMerge: false, lazyUpdate: true });
        
        PM2Chart.setOption({
            xAxis: { data: xData },
            series: [{ data: window.chartData.PM2 }]
        }, { notMerge: false, lazyUpdate: true });
        
        sunrayChart.setOption({
            xAxis: { data: xData },
            series: [{ data: window.chartData.sunray }]
        }, { notMerge: false, lazyUpdate: true });
        
        chartUpdatePending = false;
    });
}

// 更新六个图表数据（节流优化版）
window.updateChartData = function(data) {
    if (!tempChart || !humidityChart || !windChart || !lightChart || !PM2Chart || !sunrayChart) {
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
    const PM2Val = data.pm25 !== undefined && data.pm25 !== null
        ? parseInt(data.pm25)
        : 0;
    const sunrayVal = data.sunray !== undefined && data.sunray !== null
        ? parseInt(data.sunray)
        : 0;

    window.chartData.temperature.push(Number(tempVal));
    window.chartData.humidity.push(Number(humVal));
    window.chartData.windSpeed.push(Number(windVal));
    window.chartData.illumination.push(lightVal);
    window.chartData.PM2.push(PM2Val);
    window.chartData.sunray.push(sunrayVal);
    
    // 根据当前视图长度裁剪数组（实时/历史切换）
    const maxLen = window.CHART_MAX_LEN || 20;
    if (window.chartData.time.length > maxLen) {
        Object.keys(window.chartData).forEach(key => window.chartData[key].shift());
    }

    // 如果处于暂停状态，仅更新内部数据，不渲染图表
    if (window.chartRealtimePaused) return;

    // 节流控制：限制图表更新频率
    const currentTime = Date.now();
    if (currentTime - lastChartUpdate < CHART_UPDATE_THROTTLE) {
        // 如果还没有pending的更新，标记一个延迟更新
        if (!chartUpdatePending) {
            chartUpdatePending = true;
            setTimeout(() => {
                if (chartUpdatePending) {
                    lastChartUpdate = Date.now();
                    batchUpdateCharts();
                }
            }, CHART_UPDATE_THROTTLE - (currentTime - lastChartUpdate));
        }
        return;
    }
    
    lastChartUpdate = currentTime;
    batchUpdateCharts();
};

// 清空图表数据
window.clearChartData = function() {
    window.chartData = {
        time: [],
        temperature: [],
        humidity: [],
        windSpeed: [],
        illumination: [],
        PM2: [],
        sunray: []
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

    if (PM2Chart) {
        PM2Chart.setOption({
            xAxis: { data: emptyXAxis },
            series: [{ data: [0] }]
        });
    }

    if (sunrayChart) {
        sunrayChart.setOption({
            xAxis: { data: emptyXAxis },
            series: [{ data: [0] }]
        });
    }

    if (typeof window.updateDataValue === 'function') {
        window.updateDataValue('temperature', 0);
        window.updateDataValue('humidity', 0);
        window.updateDataValue('windSpeed', 0);
        window.updateDataValue('illumination', 0);
        window.updateDataValue('PM2', 0);
        window.updateDataValue('sunray', 0);
    }
};

// 切换实时暂停/恢复（暂停时继续缓存数据，不更新图表）
window.toggleChartRealtime = function() {
    window.chartRealtimePaused = !window.chartRealtimePaused;
    const btn = document.getElementById('chartPauseBtn');
    if (btn) {
        btn.textContent = window.chartRealtimePaused ? '恢复' : '暂停';
        btn.setAttribute('aria-pressed', String(window.chartRealtimePaused));
    }
    if (!window.chartRealtimePaused) {
        // 恢复后用当前缓存的数据刷新图表
        const maxLen = window.CHART_MAX_LEN || 20;
        const startIndex = Math.max(0, window.chartData.time.length - maxLen);
        const xData = window.chartData.time.slice(startIndex);
        tempChart.setOption({ xAxis: { data: xData }, series: [{ data: window.chartData.temperature.slice(startIndex) }] });
        humidityChart.setOption({ xAxis: { data: xData }, series: [{ data: window.chartData.humidity.slice(startIndex) }] });
        windChart.setOption({ xAxis: { data: xData }, series: [{ data: window.chartData.windSpeed.slice(startIndex) }] });
        lightChart.setOption({ xAxis: { data: xData }, series: [{ data: window.chartData.illumination.slice(startIndex) }] });
        PM2Chart.setOption({ xAxis: { data: xData }, series: [{ data: window.chartData.PM2.slice(startIndex) }] });
        sunrayChart.setOption({ xAxis: { data: xData }, series: [{ data: window.chartData.sunray.slice(startIndex) }] });
    }
};

// 切换历史视图与实时视图
window.toggleChartHistoryView = function() {
    const btn = document.getElementById('chartHistoryBtn');
    const isHistory = window.CHART_MAX_LEN !== (window.CHART_HISTORY_LEN || 240);
    if (isHistory) {
        // 切换到历史视图
        window.CHART_MAX_LEN = window.CHART_HISTORY_LEN || 240;
        if (btn) { btn.textContent = '实时视图'; btn.setAttribute('aria-pressed', 'true'); }
    } else {
        // 切换回实时视图
        window.CHART_MAX_LEN = 20;
        if (btn) { btn.textContent = '历史视图'; btn.setAttribute('aria-pressed', 'false'); }
    }
    // 刷新图表显示为当前缓存的最后 CHART_MAX_LEN 条
    const maxLen = window.CHART_MAX_LEN || 20;
    const startIndex = Math.max(0, window.chartData.time.length - maxLen);
    const xData = window.chartData.time.slice(startIndex);
    tempChart.setOption({ xAxis: { data: xData }, series: [{ data: window.chartData.temperature.slice(startIndex) }] });
    humidityChart.setOption({ xAxis: { data: xData }, series: [{ data: window.chartData.humidity.slice(startIndex) }] });
    windChart.setOption({ xAxis: { data: xData }, series: [{ data: window.chartData.windSpeed.slice(startIndex) }] });
    lightChart.setOption({ xAxis: { data: xData }, series: [{ data: window.chartData.illumination.slice(startIndex) }] });
    PM2Chart.setOption({ xAxis: { data: xData }, series: [{ data: window.chartData.PM2.slice(startIndex) }] });
    sunrayChart.setOption({ xAxis: { data: xData }, series: [{ data: window.chartData.sunray.slice(startIndex) }] });
};

// 重置所有图表的缩放
window.resetAllChartZoom = function() {
    if (tempChart) tempChart.dispatchAction({ type: 'dataZoom', start: 0, end: 100 });
    if (humidityChart) humidityChart.dispatchAction({ type: 'dataZoom', start: 0, end: 100 });
    if (windChart) windChart.dispatchAction({ type: 'dataZoom', start: 0, end: 100 });
    if (lightChart) lightChart.dispatchAction({ type: 'dataZoom', start: 0, end: 100 });
    if (PM2Chart) PM2Chart.dispatchAction({ type: 'dataZoom', start: 0, end: 100 });
    if (sunrayChart) sunrayChart.dispatchAction({ type: 'dataZoom', start: 0, end: 100 });
};

// 应用图表设置（由菜单设置弹窗调用）
window.applyChartSettings = function(settings) {
    if (!settings) return;
    
    // 获取图表类型和样式设置
    const chartType = settings.chartType || 'line';
    const isSmooth = settings.smooth && chartType === 'line';
    const showMarkers = true; // 始终显示数据点标记
    
    // 定义通用的系列配置更新函数
    const updateSeriesConfig = (chart, seriesConfig) => {
        if (!chart) return;
        
        const updatedConfig = {
            type: chartType,
            smooth: isSmooth,
            smoothMonotone: isSmooth ? 'x' : undefined,
            symbol: showMarkers ? 'circle' : 'none',
            symbolSize: showMarkers ? 6 : 0,
            ...seriesConfig
        };
        
        // 如果是柱状图，移除某些仅适用于折线图的属性
        if (chartType === 'bar') {
            delete updatedConfig.smooth;
            delete updatedConfig.smoothMonotone;
            delete updatedConfig.areaStyle;
        }
        
        chart.setOption({
            series: [updatedConfig]
        });
    };
    
    // 更新每个图表的系列配置
    if (tempChart) {
        updateSeriesConfig(tempChart, {
            name: '温度(℃)',
            lineStyle: chartType === 'line' ? {
                width: 3,
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
            } : undefined,
            itemStyle: {
                color: '#ef4444',
                borderColor: '#fff',
                borderWidth: chartType === 'bar' ? 0 : 2
            },
            areaStyle: chartType === 'line' ? {
                color: {
                    type: 'linear',
                    x: 0, y: 0, x2: 0, y2: 1,
                    colorStops: [
                        { offset: 0, color: 'rgba(239, 68, 68, 0.25)' },
                        { offset: 0.5, color: 'rgba(239, 68, 68, 0.1)' },
                        { offset: 1, color: 'rgba(239, 68, 68, 0.02)' }
                    ]
                }
            } : undefined
        });
    }
    
    if (humidityChart) {
        updateSeriesConfig(humidityChart, {
            name: '湿度(%)',
            lineStyle: chartType === 'line' ? {
                width: 3,
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
            } : undefined,
            itemStyle: {
                color: '#0891b2',
                borderColor: '#fff',
                borderWidth: chartType === 'bar' ? 0 : 2
            },
            areaStyle: chartType === 'line' ? {
                color: {
                    type: 'linear',
                    x: 0, y: 0, x2: 0, y2: 1,
                    colorStops: [
                        { offset: 0, color: 'rgba(8, 145, 178, 0.25)' },
                        { offset: 0.5, color: 'rgba(8, 145, 178, 0.1)' },
                        { offset: 1, color: 'rgba(8, 145, 178, 0.02)' }
                    ]
                }
            } : undefined
        });
    }
    
    if (windChart) {
        updateSeriesConfig(windChart, {
            name: '风速(m/s)',
            lineStyle: chartType === 'line' ? {
                width: 3,
                color: {
                    type: 'linear',
                    x: 0, y: 0, x2: 1, y2: 0,
                    colorStops: [
                        { offset: 0, color: '#10b981' },
                        { offset: 0.5, color: '#059669' },
                        { offset: 1, color: '#047857' }
                    ]
                },
                shadowColor: 'rgba(5, 150, 105, 0.3)',
                shadowBlur: 8,
                shadowOffsetY: 3
            } : undefined,
            itemStyle: {
                color: '#059669',
                borderColor: '#fff',
                borderWidth: chartType === 'bar' ? 0 : 2
            },
            areaStyle: chartType === 'line' ? {
                color: {
                    type: 'linear',
                    x: 0, y: 0, x2: 0, y2: 1,
                    colorStops: [
                        { offset: 0, color: 'rgba(5, 150, 105, 0.25)' },
                        { offset: 0.5, color: 'rgba(5, 150, 105, 0.1)' },
                        { offset: 1, color: 'rgba(5, 150, 105, 0.02)' }
                    ]
                }
            } : undefined
        });
    }
    
    if (lightChart) {
        updateSeriesConfig(lightChart, {
            name: '光照(lx)',
            lineStyle: chartType === 'line' ? {
                width: 3,
                color: {
                    type: 'linear',
                    x: 0, y: 0, x2: 1, y2: 0,
                    colorStops: [
                        { offset: 0, color: '#f59e0b' },
                        { offset: 0.5, color: '#d97706' },
                        { offset: 1, color: '#b45309' }
                    ]
                },
                shadowColor: 'rgba(217, 119, 6, 0.3)',
                shadowBlur: 8,
                shadowOffsetY: 3
            } : undefined,
            itemStyle: {
                color: '#d97706',
                borderColor: '#fff',
                borderWidth: chartType === 'bar' ? 0 : 2
            },
            areaStyle: chartType === 'line' ? {
                color: {
                    type: 'linear',
                    x: 0, y: 0, x2: 0, y2: 1,
                    colorStops: [
                        { offset: 0, color: 'rgba(217, 119, 6, 0.25)' },
                        { offset: 0.5, color: 'rgba(217, 119, 6, 0.1)' },
                        { offset: 1, color: 'rgba(217, 119, 6, 0.02)' }
                    ]
                }
            } : undefined
        });
    }
    
    if (PM2Chart) {
        updateSeriesConfig(PM2Chart, {
            name: 'PM2.5(μg/m³)',
            lineStyle: chartType === 'line' ? {
                width: 3,
                color: {
                    type: 'linear',
                    x: 0, y: 0, x2: 1, y2: 0,
                    colorStops: [
                        { offset: 0, color: '#8b5cf6' },
                        { offset: 0.5, color: '#7c3aed' },
                        { offset: 1, color: '#6d28d9' }
                    ]
                },
                shadowColor: 'rgba(124, 58, 237, 0.3)',
                shadowBlur: 8,
                shadowOffsetY: 3
            } : undefined,
            itemStyle: {
                color: '#7c3aed',
                borderColor: '#fff',
                borderWidth: chartType === 'bar' ? 0 : 2
            },
            areaStyle: chartType === 'line' ? {
                color: {
                    type: 'linear',
                    x: 0, y: 0, x2: 0, y2: 1,
                    colorStops: [
                        { offset: 0, color: 'rgba(124, 58, 237, 0.25)' },
                        { offset: 0.5, color: 'rgba(124, 58, 237, 0.1)' },
                        { offset: 1, color: 'rgba(124, 58, 237, 0.02)' }
                    ]
                }
            } : undefined
        });
    }
    
    if (sunrayChart) {
        updateSeriesConfig(sunrayChart, {
            name: '紫外线强度',
            lineStyle: chartType === 'line' ? {
                width: 3,
                color: {
                    type: 'linear',
                    x: 0, y: 0, x2: 1, y2: 0,
                    colorStops: [
                        { offset: 0, color: '#ec4899' },
                        { offset: 0.5, color: '#db2777' },
                        { offset: 1, color: '#be185d' }
                    ]
                },
                shadowColor: 'rgba(219, 39, 119, 0.3)',
                shadowBlur: 8,
                shadowOffsetY: 3
            } : undefined,
            itemStyle: {
                color: '#db2777',
                borderColor: '#fff',
                borderWidth: chartType === 'bar' ? 0 : 2
            },
            areaStyle: chartType === 'line' ? {
                color: {
                    type: 'linear',
                    x: 0, y: 0, x2: 0, y2: 1,
                    colorStops: [
                        { offset: 0, color: 'rgba(219, 39, 119, 0.25)' },
                        { offset: 0.5, color: 'rgba(219, 39, 119, 0.1)' },
                        { offset: 1, color: 'rgba(219, 39, 119, 0.02)' }
                    ]
                }
            } : undefined
        });
    }
    
    // 刷新图表显示
    const maxLen = window.CHART_MAX_LEN || 20;
    const startIndex = Math.max(0, window.chartData.time.length - maxLen);
    const xData = window.chartData.time.slice(startIndex);
    
    if (tempChart) tempChart.setOption({ xAxis: { data: xData }, series: [{ data: window.chartData.temperature.slice(startIndex) }] });
    if (humidityChart) humidityChart.setOption({ xAxis: { data: xData }, series: [{ data: window.chartData.humidity.slice(startIndex) }] });
    if (windChart) windChart.setOption({ xAxis: { data: xData }, series: [{ data: window.chartData.windSpeed.slice(startIndex) }] });
    if (lightChart) lightChart.setOption({ xAxis: { data: xData }, series: [{ data: window.chartData.illumination.slice(startIndex) }] });
    if (PM2Chart) PM2Chart.setOption({ xAxis: { data: xData }, series: [{ data: window.chartData.PM2.slice(startIndex) }] });
    if (sunrayChart) sunrayChart.setOption({ xAxis: { data: xData }, series: [{ data: window.chartData.sunray.slice(startIndex) }] });
    
    console.log('✅ 图表设置已应用:', settings);
};

// 绑定页面控件事件（如果存在）
document.addEventListener('DOMContentLoaded', () => {
    const pauseBtn = document.getElementById('chartPauseBtn');
    const histBtn = document.getElementById('chartHistoryBtn');
    const resetZoomBtn = document.getElementById('chartResetZoomBtn');
    if (pauseBtn) pauseBtn.addEventListener('click', window.toggleChartRealtime);
    if (histBtn) histBtn.addEventListener('click', window.toggleChartHistoryView);
    if (resetZoomBtn) resetZoomBtn.addEventListener('click', window.resetAllChartZoom);
    
    // 应用默认图表设置（折线图 + 平滑曲线）
    setTimeout(() => {
        const savedSettings = localStorage.getItem('chartSettings');
        let settings;
        if (savedSettings) {
            try {
                settings = JSON.parse(savedSettings);
            } catch (e) {
                settings = { chartType: 'line', smooth: true };
            }
        } else {
            // 默认设置
            settings = { chartType: 'line', smooth: true };
            try {
                localStorage.setItem('chartSettings', JSON.stringify(settings));
            } catch (e) {
                console.warn('保存默认设置失败', e);
            }
        }
        
        if (window.applyChartSettings && typeof window.applyChartSettings === 'function') {
            window.applyChartSettings(settings);
        }
    }, 500); // 延迟确保图表已初始化
});