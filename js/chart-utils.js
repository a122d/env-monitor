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

let combinedChart;
// 全局控制
window.CHART_MAX_LEN = 20; // 实时视图默认保留点数

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
            bottom: isMobile ? '12%' : '10%',
            top: isMobile ? '24%' : '18%'
        },
        symbolSize: isMobile ? 4 : 6,
        lineWidth: isMobile ? 2 : 3,
        rotate: isMobile ? 45 : 30
    };
}

// 初始化合并图表
window.initCharts = function() {
    if (typeof echarts === 'undefined') {
        console.error('❌ ECharts 库未加载！');
        setTimeout(window.initCharts, 200);
        return;
    }

    const chartDom = document.getElementById('combined-chart');

    if (!chartDom) {
        console.error('❌ 图表容器未找到！');
        return;
    }

    const config = getResponsiveConfig();

    // 初始化图表
    combinedChart = echarts.init(chartDom);
    
    // 配置选项
    const option = {
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
            confine: true,
            formatter: function(params) {
                if (!params || params.length === 0) return '';
                
                let result = params[0].axisValue + '<br/>';
                params.forEach(param => {
                    const index = param.dataIndex;
                    let originalValue = '';
                    let unit = '';
                    
                    // 根据系列名称获取原始数据和单位
                    switch(param.seriesName) {
                        case '温度':
                            originalValue = window.chartData.temperature[index];
                            unit = '°C';
                            break;
                        case '湿度':
                            originalValue = window.chartData.humidity[index];
                            unit = '%';
                            break;
                        case '风速':
                            originalValue = window.chartData.windSpeed[index];
                            unit = 'm/s';
                            break;
                        case '光照':
                            originalValue = window.chartData.illumination[index];
                            unit = 'lux';
                            break;
                        case 'PM2.5':
                            originalValue = window.chartData.PM2[index];
                            unit = 'μg/m³';
                            break;
                        case '紫外线':
                            originalValue = window.chartData.sunray[index];
                            unit = 'UVI';
                            break;
                    }
                    
                    result += param.marker + param.seriesName + ': ' + originalValue + unit + '<br/>';
                });
                return result;
            }
        },
        legend: {
            show: false
        },
        grid: {
            left: config.grid.left,
            right: config.grid.right,
            bottom: config.grid.bottom,
            top: config.isMobile ? '5%' : '5%',
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
        yAxis: {
            type: 'value',
            min: 0,
            max: 100,
            interval: 20,
            splitNumber: 5,
            axisLabel: {
                color: '#64748b',
                fontSize: config.fontSize.axis,
                fontWeight: 500,
                formatter: '{value}%',
                margin: 12
            },
            axisLine: { 
                show: true,
                lineStyle: { 
                    color: '#cbd5e1',
                    width: 2
                } 
            },
            axisTick: {
                show: true,
                length: 5,
                lineStyle: {
                    color: '#cbd5e1'
                }
            },
            splitLine: { 
                show: true,
                lineStyle: { 
                    color: '#e2e8f0',
                    type: 'dashed',
                    width: 1
                } 
            }
        },
        dataZoom: [
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
        ],
        series: [
            {
                name: '温度',
                type: 'line',
                smooth: true,
                smoothMonotone: 'x',
                symbol: 'circle',
                symbolSize: config.symbolSize,
                data: [],
                lineStyle: { 
                    width: config.lineWidth,
                    color: '#ef4444'
                },
                itemStyle: { 
                    color: '#ef4444',
                    borderColor: '#fff',
                    borderWidth: 2
                }
            },
            {
                name: '湿度',
                type: 'line',
                smooth: true,
                smoothMonotone: 'x',
                symbol: 'circle',
                symbolSize: config.symbolSize,
                data: [],
                lineStyle: { 
                    width: config.lineWidth,
                    color: '#0891b2'
                },
                itemStyle: { 
                    color: '#0891b2',
                    borderColor: '#fff',
                    borderWidth: 2
                }
            },
            {
                name: '风速',
                type: 'line',
                smooth: true,
                smoothMonotone: 'x',
                symbol: 'circle',
                symbolSize: config.symbolSize,
                data: [],
                lineStyle: { 
                    width: config.lineWidth,
                    color: '#8b5cf6'
                },
                itemStyle: { 
                    color: '#8b5cf6',
                    borderColor: '#fff',
                    borderWidth: 2
                }
            },
            {
                name: '光照',
                type: 'line',
                smooth: true,
                smoothMonotone: 'x',
                symbol: 'circle',
                symbolSize: config.symbolSize,
                data: [],
                lineStyle: { 
                    width: config.lineWidth,
                    color: '#f59e0b'
                },
                itemStyle: { 
                    color: '#f59e0b',
                    borderColor: '#fff',
                    borderWidth: 2
                }
            },
            {
                name: 'PM2.5',
                type: 'line',
                smooth: true,
                smoothMonotone: 'x',
                symbol: 'circle',
                symbolSize: config.symbolSize,
                data: [],
                lineStyle: { 
                    width: config.lineWidth,
                    color: '#10b981'
                },
                itemStyle: { 
                    color: '#10b981',
                    borderColor: '#fff',
                    borderWidth: 2
                }
            },
            {
                name: '紫外线',
                type: 'line',
                smooth: true,
                smoothMonotone: 'x',
                symbol: 'circle',
                symbolSize: config.symbolSize,
                data: [],
                lineStyle: { 
                    width: config.lineWidth,
                    color: '#3b82f6'
                },
                itemStyle: { 
                    color: '#3b82f6',
                    borderColor: '#fff',
                    borderWidth: 2
                }
            }
        ],
        animationDuration: 800,
        animationEasing: 'cubicOut'
    };

    combinedChart.setOption(option);

    window.addEventListener('resize', () => {
        if (combinedChart) {
            combinedChart.resize();
        }
    });
};

// 图表更新队列和RAF优化
let chartUpdatePending = false;
let lastChartUpdate = 0;
const CHART_UPDATE_THROTTLE = 500; // 限制更新频率为500ms一次

// 计算各项数据的百分比（根据进度条范围）
function calculatePercentage(value, min, max) {
    if (value === null || value === undefined || isNaN(value)) return 0;
    const percent = ((value - min) / (max - min)) * 100;
    return Math.max(0, Math.min(100, percent));
}

// 批量更新图表（使用RAF优化）
function batchUpdateCharts() {
    if (!combinedChart) {
        return;
    }
    
    const xData = window.chartData.time;
    
    // 计算各项数据的百分比
    // 温度: -10°C 到 36°C
    const tempPercent = window.chartData.temperature.map(t => calculatePercentage(t, -10, 36));
    // 湿度: 0% 到 100%
    const humidityPercent = window.chartData.humidity.map(h => h); // 已经是百分比
    // 风速: 0 m/s 到 20 m/s
    const windPercent = window.chartData.windSpeed.map(w => calculatePercentage(w, 0, 20));
    // 光照: 0 lux 到 1000 lux
    const lightPercent = window.chartData.illumination.map(l => calculatePercentage(l, 0, 1000));
    // PM2.5: 0 到 150 μg/m³
    const pm25Percent = window.chartData.PM2.map(p => calculatePercentage(p, 0, 150));
    // 紫外线: 0 到 10 UVI
    const sunrayPercent = window.chartData.sunray.map(s => calculatePercentage(s, 0, 10));
    
    // 使用requestAnimationFrame确保在下一帧渲染
    requestAnimationFrame(() => {
        combinedChart.setOption({
            xAxis: { data: xData },
            series: [
                { data: tempPercent },
                { data: humidityPercent },
                { data: windPercent },
                { data: lightPercent },
                { data: pm25Percent },
                { data: sunrayPercent }
            ]
        }, { notMerge: false, lazyUpdate: true });
        
        chartUpdatePending = false;
    });
}

// 全局更新图表数据入口
window.updateChartData = function(data) {
    if (!combinedChart) {
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
    
    // 根据当前视图长度裁剪数组
    const maxLen = window.CHART_MAX_LEN || 20;
    if (window.chartData.time.length > maxLen) {
        Object.keys(window.chartData).forEach(key => window.chartData[key].shift());
    }

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

    if (combinedChart) {
        combinedChart.setOption({
            xAxis: { data: emptyXAxis },
            series: [
                { data: [0] },
                { data: [0] },
                { data: [0] },
                { data: [0] },
                { data: [0] },
                { data: [0] }
            ]
        });
    }
};

// 重置所有图表的缩放
window.resetAllChartZoom = function() {
    if (combinedChart) {
        combinedChart.dispatchAction({ type: 'dataZoom', start: 0, end: 100 });
    }
};

// 应用图表设置（由菜单设置弹窗调用）
window.applyChartSettings = function(settings) {
    if (!settings || !combinedChart) return;
    
    // 获取图表类型和样式设置
    const chartType = settings.chartType || 'line';
    const isSmooth = settings.smooth && chartType === 'line';
    const showMarkers = true; // 始终显示数据点标记
    
    // 更新所有系列的配置
    const seriesUpdate = [];
    const seriesNames = ['温度', '湿度', '风速', '光照', 'PM2.5', '紫外线'];
    const seriesColors = ['#ef4444', '#0891b2', '#8b5cf6', '#f59e0b', '#10b981', '#3b82f6'];
    
    for (let i = 0; i < 6; i++) {
        const config = {
            type: chartType,
            smooth: isSmooth,
            smoothMonotone: isSmooth ? 'x' : undefined,
            symbol: showMarkers ? 'circle' : 'none',
            symbolSize: showMarkers ? 6 : 0,
            lineStyle: chartType === 'line' ? {
                width: 3,
                color: seriesColors[i]
            } : undefined,
            itemStyle: {
                color: seriesColors[i],
                borderColor: '#fff',
                borderWidth: chartType === 'bar' ? 0 : 2
            }
        };
        
        // 如果是柱状图，移除某些仅适用于折线图的属性
        if (chartType === 'bar') {
            delete config.smooth;
            delete config.smoothMonotone;
        }
        
        seriesUpdate.push(config);
    }
    
    combinedChart.setOption({
        series: seriesUpdate
    });
};

// 绑定页面控件事件（如果存在）
document.addEventListener('DOMContentLoaded', () => {
    const resetZoomBtn = document.getElementById('chartResetZoomBtn');
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