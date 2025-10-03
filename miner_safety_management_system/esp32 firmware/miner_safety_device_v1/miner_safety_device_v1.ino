#include <Wire.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME680.h>
#include "MAX30105.h"        // SparkFun MAX3010x library
#include "heartRate.h"       // Heart rate calculation algorithm

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

#define MQTT_MAX_PACKET_SIZE 512

// ---------- Analog Sensor Pins ----------
#define MQ137_PIN 34
#define MQ136_PIN 35
#define MQ7_PIN   32
#define MQ5_PIN   33
#define MICS2714_PIN 36

// ---------- DS18B20 ----------
#define ONE_WIRE_BUS 4
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature ds18b20(&oneWire);

// ---------- BME680 ----------
Adafruit_BME680 bme;

// ---------- MAX30102 ----------
MAX30105 particleSensor;
const byte RATE_SIZE = 4;  // increase for more smoothing
byte rates[RATE_SIZE];     // array of heart rate values
byte rateSpot = 0;
long lastBeat = 0;         // time of last beat
float beatsPerMinute;
int beatAvg;

// ---------- Wi-Fi ----------
const char* ssid     = "HUAWEI-4592";
const char* password = "77805052";

// ---------- MQTT ----------
const char*  mqttServer = "192.168.8.100";
const uint16_t mqttPort = 1883;
const char*  mqttTopic  = "health/device4";
const char*  deviceName = "device3";

WiFiClient   wifiClient;
PubSubClient mqtt(wifiClient);

unsigned long lastPublish     = 0;
const unsigned long pubInterval = 2000; // publish every 2s
unsigned long mqttBackoff     = 1000;

// ---------- Helpers ----------
void connectWiFiWithTimeout(uint32_t timeoutMs);
bool connectMQTT();

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n— ESP32 SENSOR + MQTT Publisher —");

  // Start DS18B20
  ds18b20.begin();

  // Start BME680
  if (!bme.begin()) {
    Serial.println("BME680 not found!");
  } else {
    bme.setTemperatureOversampling(BME680_OS_8X);
    bme.setHumidityOversampling(BME680_OS_2X);
    bme.setPressureOversampling(BME680_OS_4X);
    bme.setIIRFilterSize(BME680_FILTER_SIZE_3);
    bme.setGasHeater(320, 150);
  }

  // Start MAX30102
  if (!particleSensor.begin(Wire, I2C_SPEED_STANDARD)) {
    Serial.println("MAX30102 not found!");
  } else {
    particleSensor.setup(); // default settings
    particleSensor.setPulseAmplitudeRed(0x0A); // low brightness for IR
    particleSensor.setPulseAmplitudeGreen(0);  // turn off green LED
  }

  // Wi-Fi + MQTT
  mqtt.setBufferSize(MQTT_MAX_PACKET_SIZE);
  mqtt.setServer(mqttServer, mqttPort);

  connectWiFiWithTimeout(20000);
  connectMQTT();
}

void loop() {
  if (!mqtt.connected()) {
    if (connectMQTT()) mqttBackoff = 1000;
    else {
      mqttBackoff = min(mqttBackoff * 2, 30000UL);
      delay(mqttBackoff);
    }
  }
  mqtt.loop();

  // --------- Heart Rate Reading ---------
  long irValue = particleSensor.getIR();

  if (checkForBeat(irValue) == true) {
    // Calculate BPM
    long delta = millis() - lastBeat;
    lastBeat = millis();

    beatsPerMinute = 60 / (delta / 1000.0);

    if (beatsPerMinute < 255 && beatsPerMinute > 20) {
      rates[rateSpot++] = (byte)beatsPerMinute; // store reading
      rateSpot %= RATE_SIZE; // wrap index

      // Average BPM
      beatAvg = 0;
      for (byte x = 0; x < RATE_SIZE; x++)
        beatAvg += rates[x];
      beatAvg /= RATE_SIZE;
    }
  }

  if (millis() - lastPublish >= pubInterval && mqtt.connected()) {
    lastPublish = millis();

    // --------- Sensor Reads ---------
    int mq137 = analogRead(MQ137_PIN);
    int mq136 = analogRead(MQ136_PIN);
    int mq7   = analogRead(MQ7_PIN);
    int mq5   = analogRead(MQ5_PIN);
    int mics2714 = analogRead(MICS2714_PIN);

    ds18b20.requestTemperatures();
    float bodyTemp = ds18b20.getTempCByIndex(0);
    if (bodyTemp < -50 || bodyTemp > 125) bodyTemp = 0; // invalid reading

    float envTemp = 0, humidity = 0, pressure = 0, gasRes = 0;
    if (bme.performReading()) {
      envTemp  = bme.temperature;
      humidity = bme.humidity;
      pressure = bme.pressure / 100.0;
      gasRes   = bme.gas_resistance;
    }

    // --------- JSON Build ---------
    StaticJsonDocument<384> doc;
    doc["deviceName"] = deviceName;

    JsonObject sensor = doc.createNestedObject("sensorData");
    JsonObject vitals = sensor.createNestedObject("vitals");
    JsonObject env    = sensor.createNestedObject("environment");

    // Vitals
    vitals["bodyTemp"]  = bodyTemp;
    vitals["heartRate"] = beatAvg; // real BPM

    // Environment
    env["carbonMonoxide"]  = mq7;
    env["ammonia"]         = mq137;
    env["hydrogenSulfide"] = mq136;
    env["methane"]         = mq5;
    env["nitrogenDioxide"] = mics2714;
    env["temperature"]     = envTemp;
    env["pressure"]        = pressure;
    env["humidity"]        = humidity;
    env["gasResistance"]   = gasRes;

    // --------- Publish ---------
    char buffer[512];
    size_t len = serializeJson(doc, buffer);

    bool ok = mqtt.publish(mqttTopic, buffer, len);
    Serial.print("MQTT Publish: ");
    Serial.println(ok ? "SUCCESS" : "FAILURE");
    Serial.println(buffer);
  }
}

// ==============================
// Helpers
// ==============================
void connectWiFiWithTimeout(uint32_t timeoutMs) {
  Serial.printf("Connecting to Wi-Fi SSID \"%s\" …\n", ssid);
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < timeoutMs) {
    delay(250);
    Serial.print(".");
  }
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("\nWi-Fi connection timed out — restarting");
    delay(1000);
    ESP.restart();
  }
  Serial.printf("\nWi-Fi connected, IP = %s\n", WiFi.localIP().toString().c_str());
}

bool connectMQTT() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Wi-Fi not connected; skipping MQTT connect");
    return false;
  }
  Serial.printf("Connecting to MQTT %s:%u …\n", mqttServer, mqttPort);
  if (mqtt.connect(deviceName)) {
    Serial.println("MQTT connected");
    return true;
  } else {
    Serial.printf("MQTT failed, rc=%d\n", mqtt.state());
    return false;
  }
}
