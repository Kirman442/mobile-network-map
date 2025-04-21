import { AmbientLight, PointLight, LightingEffect, DirectionalLight } from '@deck.gl/core';

// Настройка освещения для холодной схемы
const ambientLight = new AmbientLight({
    color: [12, 204, 238, 250], // rgb(12, 148, 238)
    intensity: 1.0
});

const pointLight1 = new PointLight({
    color: [255, 255, 255, 155], // rgb(100, 172, 255)
    intensity: 2.2,
    position: [-0.144528, 49.739968, 100000]
});

const pointLight2 = new PointLight({
    color: [70, 130, 230],
    intensity: 1,
    position: [-3.807751, 54.104682, 80000]
});

// Добавляем третий источник света для улучшения эффекта сияния
const pointLight3 = new PointLight({
    color: [130, 225, 255],
    intensity: .5,
    position: [5, 52.5, 600000]
});

const directionalLight = new DirectionalLight({
    color: [255, 255, 255],
    direction: [0, 0, -1],
    intensity: 1
});

export const lightingEffect = new LightingEffect({
    ambientLight,
    pointLight1,
    pointLight2,
    pointLight3,
    directionalLight
    // cameraLight
});