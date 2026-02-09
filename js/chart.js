/**
 * 图表数据管理与交互 (合并自 chart-utils.js + chart-legend.js)
 */
// 图表数据与实例
function createEmptyChartData() {
    return { time: [], temperature: [], humidity: [], windSpeed: [], illumination: [], PM2: [], sunray: [] };
}
window.chartData = createEmptyChartData();

let combinedChart;

// ===== 图表传感器配置表 =====
const SERIES_NAMES = ['温度', '湿度', '风速', '光照', 'PM2.5', '紫外线'];
const CHART_SENSOR_KEYS = ['temperature', 'humidity', 'windSpeed', 'illumination', 'PM2', 'sunray'];
const SENSOR_RANGES = [
    { key: 'temperature', min: -10, max: 36 },  // ℃
    { key: 'humidity',    min: 0,   max: 100 },  // % (直接使用)
    { key: 'windSpeed',   min: 0,   max: 20 },   // m/s
    { key: 'illumination', min: 0,  max: 1000 },  // lux
    { key: 'PM2',         min: 0,   max: 150 },   // μg/m³
    { key: 'sunray',      min: 0,   max: 10 }     // UVI
];

// 传感器值解析配置（与 mqtt.js 的 DATA_PARSE_CONFIG 对应）
const CHART_PARSE_CONFIG = [
    { field: 'temperature',  parse: v => parseFloat(parseFloat(v) / 10).toFixed(1), default: '0' },
    { field: 'humidity',     parse: v => parseFloat(parseFloat(v) / 10).toFixed(1), default: '0' },
    { field: 'windSpeed',    parse: v => parseFloat(parseFloat(v) / 10).toFixed(1), default: '0' },
    { field: 'illumination', parse: v => parseInt(v),                                default: 0 },
    { field: 'pm25',         parse: v => parseInt(v),                                default: 0,  chartKey: 'PM2' },
    { field: 'sunray',       parse: v => parseFloat(parseFloat(v) / 10).toFixed(1), default: '0' }
];

/**
 * 计算所有传感器的百分比数据 + 构建 series 数据
 * @param {boolean} lazyUpdate - 是否懒更新
 * @returns {{ xData: string[], seriesData: Array, lazyUpdate: boolean }}
 */
function computeChartSeriesData(lazyUpdate = true) {
    const xData = window.chartData.time;
    const seriesData = SENSOR_RANGES.map(range => {
        const rawData = window.chartData[range.key];
        // 湿度已经是百分比，直接使用
        const data = range.key === 'humidity'
            ? rawData
            : rawData.map(v => calculatePercentage(v, range.min, range.max));
        return { data };
    });
    return { xData, seriesData, lazyUpdate };
}
// 全局控制
window.CHART_MAX_LEN = 25; // 实时视图默认保留点数（历史数据+1条实时）

// 显示图表加载错误
function showChartLoadingError(message) {
    const chartDom = document.getElementById('combined-chart');
    if (chartDom) {
        chartDom.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #ef4444; flex-direction: column; gap: 10px;">
                <div style="font-size: 48px;">⚠️</div>
                <div style="font-size: 16px; font-weight: 500;">${message}</div>
                <button onclick="location.reload()" style="padding: 8px 16px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">刷新页面</button>
            </div>
        `;
    }
}

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
            bottom: isMobile ? '16%' : '10%',
            top: isMobile ? '24%' : '18%'
        },
        symbolSize: isMobile ? 4 : 6,
        lineWidth: isMobile ? 2 : 3,
        rotate: isMobile ? 45 : 30
    };
}

// ECharts加载超时计数
let echartsLoadAttempts = 0;
const MAX_LOAD_ATTEMPTS = 50; // 最多尝试10秒 (50 * 200ms)

// 初始化合并图表
window.initCharts = function() {
    const loadingIndicator = document.getElementById('chartLoadingIndicator');
    
    if (typeof echarts === 'undefined') {
        echartsLoadAttempts++;
        if (echartsLoadAttempts >= MAX_LOAD_ATTEMPTS) {
            console.error('❌ ECharts 库加载超时！请检查网络连接');
            showChartLoadingError('图表库加载失败，请刷新页面重试');
            return;
        }
        
        // 更新加载文本
        if (loadingIndicator) {
            const loadingText = loadingIndicator.querySelector('.chart-loading-text');
            if (loadingText) {
                loadingText.textContent = `正在加载图表库... (${echartsLoadAttempts}/${MAX_LOAD_ATTEMPTS})`;
            }
        }
        
        console.warn(`⏳ 等待 ECharts 加载... (${echartsLoadAttempts}/${MAX_LOAD_ATTEMPTS})`);
        setTimeout(window.initCharts, 200);
        return;
    }

    // 隐藏加载指示器
    if (loadingIndicator) {
        loadingIndicator.classList.add('hidden');
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
                            originalValue = Number(window.chartData.sunray[index]).toFixed(1);
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
                bottom: config.isMobile ? '2%' : '2%',
                height: config.isMobile ? 25 : 30,
                showDetail: true,
                showDataShadow: true,
                brushSelect: true,
                borderColor: '#e2e8f0',
                fillerColor: 'rgba(37, 99, 235, 0.15)',
                handleIcon: 'path://M10.7,11.9H9.3c-4.9,0.3-8.8,4.4-8.8,9.4c0,5,3.9,9.1,8.8,9.4h1.3c4.9-0.3,8.8-4.4,8.8-9.4C19.5,16.3,15.6,12.2,10.7,11.9z M13.3,24.4H6.7v-1.2h6.6z M13.3,22H6.7v-1.2h6.6z M13.3,19.6H6.7v-1.2h6.6z',
                handleSize: config.isMobile ? '120%' : '140%',
                handleStyle: {
                    color: '#2563eb',
                    borderColor: '#fff',
                    borderWidth: 2,
                    shadowBlur: 8,
                    shadowColor: 'rgba(37, 99, 235, 0.4)',
                    shadowOffsetX: 0,
                    shadowOffsetY: 2
                },
                moveHandleSize: 8,
                moveHandleStyle: {
                    color: '#3b82f6',
                    opacity: 0.6
                },
                emphasis: {
                    handleStyle: {
                        color: '#1d4ed8',
                        shadowBlur: 12,
                        shadowColor: 'rgba(37, 99, 235, 0.6)'
                    },
                    moveHandleStyle: {
                        color: '#2563eb',
                        opacity: 0.8
                    }
                },
                dataBackground: {
                    lineStyle: {
                        color: '#cbd5e1',
                        width: 1
                    },
                    areaStyle: {
                        color: 'rgba(203, 213, 225, 0.3)'
                    }
                },
                selectedDataBackground: {
                    lineStyle: {
                        color: '#3b82f6',
                        width: 1.5
                    },
                    areaStyle: {
                        color: 'rgba(37, 99, 235, 0.2)'
                    }
                },
                textStyle: {
                    color: '#64748b',
                    fontSize: config.isMobile ? 10 : 11
                },
                filterMode: 'filter',
                labelFormatter: function(value, valueStr) {
                    return valueStr;
                },
                zoomLock: false,
                throttle: 100
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

    // 窗口大小变化时自动调整图表尺寸
    let resizeTimer = null;
    let resizeRAF = null;
    
    const handleResize = () => {
        // 取消之前的动画帧
        if (resizeRAF) {
            cancelAnimationFrame(resizeRAF);
        }
        
        // 使用RAF确保在浏览器下次重绘前调整
        resizeRAF = requestAnimationFrame(() => {
            if (combinedChart) {
                combinedChart.resize();
            }
        });
        
        // 清除之前的定时器
        if (resizeTimer) {
            clearTimeout(resizeTimer);
        }
        
        // 延迟再调整一次，确保完全响应
        resizeTimer = setTimeout(() => {
            if (combinedChart) {
                combinedChart.resize();
            }
        }, 100);
    };
    
    window.addEventListener('resize', handleResize, { passive: true });
    
    // 监听全屏变化
    document.addEventListener('fullscreenchange', handleResize);
    document.addEventListener('webkitfullscreenchange', handleResize);
    document.addEventListener('mozfullscreenchange', handleResize);
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
    if (!combinedChart) return;

    const { xData, seriesData } = computeChartSeriesData(true);
    requestAnimationFrame(() => {
        combinedChart.setOption({
            xAxis: { data: xData },
            series: seriesData
        }, { notMerge: false, lazyUpdate: true });
        chartUpdatePending = false;
    });
}

// 全局更新图表数据入口
// 📊 实时数据更新：始终只保留一条最新实时数据，覆盖而非追加
window.updateChartData = function(data) {
    if (!combinedChart) {
        console.warn('⚠️ 图表未初始化，跳过更新');
        return;
    }

    const now = new Date().toLocaleTimeString();
    
    // 解析数据值（配置驱动）
    const parsedValues = {};
    for (const cfg of CHART_PARSE_CONFIG) {
        const raw = data[cfg.field];
        const key = cfg.chartKey || cfg.field;
        parsedValues[key] = (raw !== undefined && raw !== null) ? cfg.parse(raw) : cfg.default;
    }

    // 获取历史数据条数（如果已设置）
    const historyCount = window.chartHistoryCount || 0;
    const currentLen = window.chartData.time.length;
    
    if (historyCount > 0 && currentLen >= historyCount) {
        // 已有历史数据 + 实时数据，覆盖最后一条实时数据
        const lastIdx = currentLen - 1;
        window.chartData.time[lastIdx] = now;
        for (const key of CHART_SENSOR_KEYS) {
            window.chartData[key][lastIdx] = Number(parsedValues[key]);
        }
    } else {
        // 无历史数据或首次添加实时数据，直接追加
        window.chartData.time.push(now);
        for (const key of CHART_SENSOR_KEYS) {
            window.chartData[key].push(Number(parsedValues[key]));
        }
        
        // 限制最大长度（无历史数据时的fallback）
        const maxLen = window.CHART_MAX_LEN || 25;
        if (window.chartData.time.length > maxLen) {
            Object.keys(window.chartData).forEach(key => window.chartData[key].shift());
        }
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
    window.chartData = createEmptyChartData();

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

// 📊 从已有数据刷新图表显示（用于历史数据加载后刷新）
window.refreshChartFromData = function() {
    if (!combinedChart) {
        console.warn('⚠️ 图表未初始化，跳过刷新');
        return;
    }
    
    if (!window.chartData || !window.chartData.time.length) {
        console.warn('⚠️ 无图表数据可显示');
        return;
    }
    
    const { xData, seriesData } = computeChartSeriesData(false);
    combinedChart.setOption({
        xAxis: { data: xData },
        series: seriesData
    }, { notMerge: false, lazyUpdate: false });
    
    // 重置缩放到显示全部数据
    combinedChart.dispatchAction({
        type: 'dataZoom',
        start: 0,
        end: 100
    });
};

// 重置所有图表的缩放
window.resetAllChartZoom = function() {
    if (combinedChart) {
        combinedChart.dispatchAction({ 
            type: 'dataZoom', 
            start: 0, 
            end: 100 
        });
    }
};

// 设置图表缩放范围
window.setChartZoom = function(type) {
    if (!combinedChart || !window.chartData || !window.chartData.time.length) {
        console.warn('图表未初始化或无数据');
        return;
    }
    
    const totalPoints = window.chartData.time.length;
    let start = 0;
    let end = 100;
    
    switch(type) {
        case 'all':
            start = 0;
            end = 100;
            break;
        case 'last10':
            if (totalPoints > 10) {
                start = Math.max(0, ((totalPoints - 10) / totalPoints) * 100);
                end = 100;
            }
            break;
        case 'last20':
            if (totalPoints > 20) {
                start = Math.max(0, ((totalPoints - 20) / totalPoints) * 100);
                end = 100;
            }
            break;
        case 'last50':
            if (totalPoints > 50) {
                start = Math.max(0, ((totalPoints - 50) / totalPoints) * 100);
                end = 100;
            }
            break;
    }
    
    combinedChart.dispatchAction({
        type: 'dataZoom',
        start: start,
        end: end
    });
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

// ===== 图表图例交互 (原 chart-legend.js) =====
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
                            name: SERIES_NAMES[seriesIndex]
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
        if (!sent) {
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
