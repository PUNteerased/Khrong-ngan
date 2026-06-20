#include "dispenser.h"

#include <Wire.h>

#if __has_include("config.h")
#include "config.h"
#else
#include "config.example.h"
#endif

#ifndef SERVO_ALL_GAP_MS
#define SERVO_ALL_GAP_MS 400
#endif

#if __has_include(<Adafruit_PWMServoDriver.h>)
#include <Adafruit_PWMServoDriver.h>
#define DISPENSER_HAS_PCA9685 1
static Adafruit_PWMServoDriver pwm(PCA9685_I2C_ADDR);
#else
#define DISPENSER_HAS_PCA9685 0
#endif

static bool pwmReady = false;
static bool dispenseBusy = false;

static void writeServoPulse(uint8_t channel, uint16_t pulseUs) {
#if DISPENSER_HAS_PCA9685
  if (!pwmReady) return;
  const uint32_t tick = (pulseUs * 4096UL) / 20000UL;
  pwm.setPWM(channel, 0, tick);
#endif
}

static void writeServoStop(uint8_t channel) {
#if DISPENSER_HAS_PCA9685
  if (!pwmReady) return;
  writeServoPulse(channel, SERVO_STOP_US);
  delay(150);
  pwm.setPWM(channel, 0, 4096);
#endif
}

static void stopAllServos() {
#if DISPENSER_HAS_PCA9685
  if (!pwmReady) return;
  for (uint8_t ch = 0; ch < DISPENSER_SLOT_COUNT; ch++) {
    writeServoStop(ch);
  }
#endif
}

void dispenserSetup() {
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  Serial.printf("[dispenser] I2C SDA=GPIO%d SCL=GPIO%d slots=%d\n",
                I2C_SDA_PIN, I2C_SCL_PIN, DISPENSER_SLOT_COUNT);

#if DISPENSER_HAS_PCA9685
  pwm.begin();
  pwm.setOscillatorFrequency(27000000);
  pwm.setPWMFreq(PCA9685_PWM_FREQ);
  for (uint8_t ch = 0; ch < DISPENSER_SLOT_COUNT; ch++) {
    writeServoStop(ch);
  }
  pwmReady = true;
  Serial.println("[dispenser] PCA9685 ready (channels 0-9)");
#else
  Serial.println("[dispenser] PCA9685 lib not linked — stub mode");
#endif
}

void dispenserLoop() {
  static unsigned long lastIdleStopMs = 0;
  const unsigned long now = millis();
  if (dispenseBusy || !pwmReady) return;
  if (now - lastIdleStopMs < 2000) return;
  lastIdleStopMs = now;
  stopAllServos();
}

bool dispenserDispenseSlot(uint8_t slotIndex) {
  if (slotIndex >= DISPENSER_SLOT_COUNT) return false;
  Serial.printf("[web-cmd] spinning PCA9685 channel %u\n", slotIndex);
  Serial.printf("[dispenser] spin slot %u\n", slotIndex);

#if DISPENSER_HAS_PCA9685
  dispenseBusy = true;
  writeServoPulse(slotIndex, SERVO_SPIN_US);
  delay(SERVO_SPIN_MS);
  writeServoStop(slotIndex);
  dispenseBusy = false;
  return true;
#else
  delay(SERVO_SPIN_MS);
  return true;
#endif
}

bool dispenserDispenseAll() {
#if DISPENSER_HAS_PCA9685
  if (!pwmReady) return false;
#endif
  Serial.println("[web-cmd] dispense_all — spinning channels 0-9");
  bool allOk = true;
  for (uint8_t ch = 0; ch < DISPENSER_SLOT_COUNT; ch++) {
    if (!dispenserDispenseSlot(ch)) allOk = false;
    if (ch + 1 < DISPENSER_SLOT_COUNT) delay(SERVO_ALL_GAP_MS);
  }
  Serial.printf("[web-cmd] dispense_all done ok=%s\n", allOk ? "true" : "false");
  return allOk;
}
