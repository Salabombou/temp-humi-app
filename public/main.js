const temperatures = []
const humidities = []

function loadTemperature() {
  return fetch('/api/data/temperature')
    .then((response) => response.json())
}

function loadHumidity() {
  return fetch('/api/data/humidity')
    .then((response) => response.json())
}

document.addEventListener('DOMContentLoaded', async () => {
  temperatures.push(...(await loadTemperature()));
  const temperatureChart = new Chart("temp-canvas", {
    type: 'line',
    data: {
      labels: Array.from({ length: 20 }, (_, i) => i * 5).reverse(),
      datasets: [{
        label: 'Temperature',
        data: temperatures,
        borderColor: 'red',
        fill: false
      }]
    },
    options: {
      legend: {
        display: false
      },
      scales: {
        yAxes: [{
          ticks: {
            suggestedMin: Math.min(...temperatures) - 0.5,
            suggestedMax: Math.max(...temperatures) + 0.5
          }
        }]
      }
    }
  });

  document.getElementById('avg-temp').innerText = (temperatures.reduce((acc, value) => acc + value, 0) / temperatures.length).toFixed(2);

  const tempWs = new WebSocket(`ws://${window.location.host}/api/ws/temperature`);
  tempWs.onmessage = (event) => {
    const message = event.data;
    const value = parseFloat(message);
    if (isNaN(value)) {
      console.error('Invalid temperature value:', message);
      return;
    }

    while (temperatures.length >= 20) {
      temperatures.shift();
    }

    temperatures.push(value);

    temperatureChart.data.datasets[0].data = temperatures;

    temperatureChart.options.scales.yAxes[0].ticks.suggestedMin = Math.min(...temperatureChart.data.datasets[0].data) - 0.5;
    temperatureChart.options.scales.yAxes[0].ticks.suggestedMax = Math.max(...temperatureChart.data.datasets[0].data) + 0.5;

    temperatureChart.update();

    document.getElementById('avg-temp').innerText = (temperatures.reduce((acc, value) => acc + value, 0) / temperatures.length).toFixed(2);

    tempLastUpdateMillis = Date.now();
  };

  humidities.push(...(await loadHumidity()));

  const humidityChart = new Chart("humi-canvas", {
    type: 'line',
    data: {
      labels: Array.from({ length: 20 }, (_, i) => i * 5).reverse(),
      datasets: [{
        label: 'Humidity',
        data: humidities,
        borderColor: 'blue',
        fill: false
      }]
    },
    options: {
      legend: {
        display: false
      },
      scales: {
        yAxes: [{
          ticks: {
            suggestedMin: Math.min(...humidities) - 0.5,
            suggestedMax: Math.max(...humidities) + 0.5
          }
        }]
      }
    }
  });

  document.getElementById('avg-humi').innerText = (humidities.reduce((acc, value) => acc + value, 0) / humidities.length).toFixed(2);

  const humiWs = new WebSocket(`ws://${window.location.host}/api/ws/humidity`);

  humiWs.onmessage = (event) => {
    const message = event.data;
    const value = parseFloat(message);
    if (isNaN(value)) {
      console.error('Invalid humidity value:', message);
      return;
    }

    while (humidities.length >= 20) {
      humidities.shift();
    }

    humidities.push(value);

    humidityChart.data.datasets[0].data = humidities;

    humidityChart.options.scales.yAxes[0].ticks.suggestedMin = Math.min(...humidityChart.data.datasets[0].data) - 0.5;
    humidityChart.options.scales.yAxes[0].ticks.suggestedMax = Math.max(...humidityChart.data.datasets[0].data) + 0.5;

    humidityChart.update();

    document.getElementById('avg-humi').innerText = (humidities.reduce((acc, value) => acc + value, 0) / humidities.length).toFixed(2);

    humiLastUpdateMillis = Date.now();
  };

  let tempLastUpdateMillis = Date.now();
  let humiLastUpdateMillis = Date.now();

  const lastUpdateTemp = document.getElementById('last-update-temp');
  const lastUpdateHumi = document.getElementById('last-update-humi');

  setInterval(() => {
    const currentMillis = Date.now();
    const tempDiffMillis = currentMillis - tempLastUpdateMillis;
    const humiDiffMillis = currentMillis - humiLastUpdateMillis;

    lastUpdateTemp.innerText = tempDiffMillis;
    lastUpdateHumi.innerText = humiDiffMillis;
  });
});
