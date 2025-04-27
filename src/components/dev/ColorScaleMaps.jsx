import { scaleLinear } from 'd3-scale';

export const SPEED_DOMAIN_DKBPS = [1, 250000, 500000, 700000, 900000, 1500000, 2000000];
// export const SPEED_DOMAIN_UKBPS = [1, 150000, 300000, 500000, 700000, 8000000, 930000]

// Electric Violet
// ["#1A237E", "#283593", "#303F9F", "#3949AB", "#43A047", "#8BC34A"]
export const COLOR_RANGE_ElectricViolet = [
    [26, 35, 126, 250],	 // #1A237E
    [40, 53, 147, 250],	 // #283593
    [48, 63, 159, 250],	 // #303F9F
    [57, 73, 171, 250],	 // #3949AB
    [67, 160, 71, 250],	 // #43A047
    [139, 195, 74, 250], // #8BC34A
];
// Vivid Gem
// ["f72585", "7209b7", "3a0ca3", "4361ee", "4cc9f0", "88dceb"]
export const COLOR_RANGE_VividGem = [
    [247, 37, 133, 250],	// #f72585
    [114, 9, 183, 250],	    // #7209b7
    [58, 12, 163, 250],	    // #3a0ca3
    [67, 97, 238, 250],	    // #4361ee
    [76, 201, 240, 250],	// #4cc9f0
    [136, 220, 235, 250],	// #88dceb
];
// Inferno Gradient
// ["1a004d", "390099", "9e0059", "ff0054", "ff5400", "ffbd00"]
export const COLOR_RANGE_InfernoGradient = [
    [105, 47, 221, 250], //rgb(105, 47, 221)
    [79, 37, 151, 250],	 //rgb(79, 37, 151)
    [158, 0, 89, 250],	 // #9e0059
    [255, 0, 84, 250],	 // #ff0054
    [255, 84, 0, 250],	 // #ff5400
    [255, 189, 0, 250],	 // #ffbd00
];
// Muted Stone
// ['#cac4d9', '#a9b4ca', '#8d89b8', '#7168a8', '#9165ca', '#6a5a9c']
export const COLOR_RANGE_MutedStone = [
    [106, 90, 156, 250],	 // #6a5a9c
    [145, 101, 202, 250],	 // #9165ca
    [113, 104, 168, 250],	 // #7168a8
    [141, 137, 184, 250],	 // #8d89b8
    [169, 180, 202, 250],	 // #a9b4ca
    [202, 196, 217, 250],	 // #cac4d9
];

// Цветовые схемы для слоёв Hexagon and Heatmap

export const COLOR_RANGE_AGGREGATE = {
    BrightSpectrum: [
        [1, 152, 189, 180],      // #0198bd
        [73, 227, 206, 180],     // #49e3ce
        [216, 254, 181, 180],    // #d8feb5
        [254, 237, 177, 180],    // #feedb1
        [254, 173, 84, 180],     // #fead54
        [209, 55, 78, 180]       // #d1374e
    ],
    //     Deep Mauve 
    // ['#f1eef6', '#d4b9da', '#c994c7', '#df65b0', '#980043', '#dd1c77']
    DeepMauve: [
        [221, 28, 119, 250],	 // #dd1c77
        [152, 0, 67, 250],	     // #980043
        [223, 101, 176, 250],	 // #df65b0
        [201, 148, 199, 250],	 // #c994c7
        [212, 185, 218, 250],	 // #d4b9da
        [241, 238, 246, 250],	 // #f1eef6
    ],
    //     Twilight Blue
    // ['#edf8fb', '#bfd3e6', '#9ebcda', '#8c96c6', '#810f7c', '#8856a7']
    TwilightBlue: [
        [136, 86, 167, 250],	 // #8856a7
        [129, 15, 124, 250],	 // #810f7c
        [140, 150, 198, 250],	 // #8c96c6
        [158, 188, 218, 250],	 // #9ebcda
        [191, 211, 230, 250],	 // #bfd3e6
        [237, 248, 251, 250],	 // #edf8fb
    ],
    //     Marine Teal
    // ['#ffffcc', '#c7e9b4', '#7fcdbb', '#41b6c4', '#2c7fb8', '#253494']
    MarineTeal: [
        [37, 52, 148, 250],	     // #253494
        [44, 127, 184, 250],	 // #2c7fb8
        [65, 182, 196, 250],	 // #41b6c4
        [127, 205, 187, 250],	 // #7fcdbb
        [199, 233, 180, 250],	 // #c7e9b4
        [255, 255, 204, 250],	 // #ffffcc
    ]
};


export const avgd_ElectricViolet_ScaleFunction = scaleLinear().domain(SPEED_DOMAIN_DKBPS).range(COLOR_RANGE_ElectricViolet);
export const avgd_VividGem_ScaleFunction = scaleLinear().domain(SPEED_DOMAIN_DKBPS).range(COLOR_RANGE_VividGem);
export const avgd_InfernoGradient_ScaleFunction = scaleLinear().domain(SPEED_DOMAIN_DKBPS).range(COLOR_RANGE_InfernoGradient);
export const avgd_MutedStone_ScaleFunction = scaleLinear().domain(SPEED_DOMAIN_DKBPS).range(COLOR_RANGE_MutedStone);


export const SCHEME_REGISTRY = {
    // Схемы для Scatterplot (используют activeColorSchemeKey)
    'ElectricViolet': {
        displayName: 'Speed Cinema', // Имя для кнопки и легенды
        domain: SPEED_DOMAIN_DKBPS,        // Массив домена
        colorRange: COLOR_RANGE_ElectricViolet, // Массив цветов (для colorRange Deck.gl и легенды)
        scaleFunction: avgd_ElectricViolet_ScaleFunction, // Ссылка на D3 функцию (для getFillColor)
        layerType: 'scatterplot'
    },
    'VividGem': {
        displayName: 'Vivid Gem',
        domain: SPEED_DOMAIN_DKBPS,
        colorRange: COLOR_RANGE_VividGem,
        scaleFunction: avgd_VividGem_ScaleFunction,
        layerType: 'scatterplot'
    },
    'InfernoLava': {
        displayName: 'Inferno Lava',
        domain: SPEED_DOMAIN_DKBPS,
        colorRange: COLOR_RANGE_InfernoGradient,
        scaleFunction: avgd_InfernoGradient_ScaleFunction,
        layerType: 'scatterplot'
    },
    'MutedStone': {
        displayName: 'Muted Stone',
        domain: SPEED_DOMAIN_DKBPS,
        colorRange: COLOR_RANGE_MutedStone,
        scaleFunction: avgd_MutedStone_ScaleFunction,
        layerType: 'scatterplot'
    },

    // Схемы для Hexagon/Heatmap (используют activeColorHexagonSchemeKey)
    'BrightSpectrum': {
        displayName: 'Bright Spectrum',
        domain: SPEED_DOMAIN_DKBPS,
        colorRange: COLOR_RANGE_AGGREGATE.BrightSpectrum,
        layerType: 'hexagon-heatmap'
    },
    'DeepMauve': {
        displayName: 'Deep Mauve',
        domain: SPEED_DOMAIN_DKBPS,
        colorRange: COLOR_RANGE_AGGREGATE.DeepMauve,
        layerType: 'hexagon-heatmap'
    },
    'TwilightBlue': {
        displayName: 'Twilight Blue',
        domain: SPEED_DOMAIN_DKBPS,
        colorRange: COLOR_RANGE_AGGREGATE.TwilightBlue,
        layerType: 'hexagon-heatmap'
    },
    'MarineTeal': {
        displayName: 'Marine Teal',
        domain: SPEED_DOMAIN_DKBPS,
        colorRange: COLOR_RANGE_AGGREGATE.MarineTeal,
        layerType: 'hexagon-heatmap'
    },
};