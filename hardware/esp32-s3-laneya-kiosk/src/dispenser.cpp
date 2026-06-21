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

#ifndef SERVO_MAX_SPIN_MS
#define SERVO_MAX_SPIN_MS (SERVO_SPIN_MS + 500)
#endif

#ifndef PCA9685_OE_PIN
#define PCA9685_OE_PIN -1
#endif

#ifndef DISPENSER_IDLE_STOP_MS
#define DISPENSER_IDLE_STOP_MS 30000
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
static bool pwmOutputsOn = false;
static unsigned long lastIdleStopMs = 0;

static void pwmOutputsEnable(bool enable) {
#if PCA9685_OE_PIN >= 0
  pinMode(PCA9685_OE_PIN, OUTPUT);
  digitalWrite(PCA9685_OE_PIN, enable ? LOW : HIGH);
  pwmOutputsOn = enable;
#else
  (void)enable;
  pwmOutputsOn = true;
#endif
}

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
  // 360° continuous servo: stop = no PWM (not 1500μs — that spins idle)
  pwm.setPWM(channel, 0, 4096);
#endif
}

static void stopAllServos() {
#if DISPENSER_HAS_PCA9685
  if (!pwmReady) return;
  for (uint8_t ch = 0; ch < DISPENSER_SLOT_COUNT; ch++) {
    pwm.setPWM(ch, 0, 4096);
  }
#endif
}

static void spinWaitMs(uint16_t durationMs) {
  const unsigned long deadline = millis() + durationMs;
  while ((long)(millis() - deadline) < 0) {
    yield();
  }
}

class DispenseSlotGuard {
 public:
  explicit DispenseSlotGuard(uint8_t channel) : channel_(channel), active_(true) {
    dispenseBusy = true;
  }

  ~DispenseSlotGuard() {
    if (active_) {
      writeServoStop(channel_);
      dispenseBusy = false;
    }
  }

  void release() {
    writeServoStop(channel_);
    dispenseBusy = false;
    active_ = false;
  }

  DispenseSlotGuard(const DispenseSlotGuard&) = delete;
  DispenseSlotGuard& operator=(const DispenseSlotGuard&) = delete;

 private:
  uint8_t channel_;
  bool active_;
};

void dispenserPreBoot() {
#if PCA9685_OE_PIN >= 0
  pinMode(PCA9685_OE_PIN, OUTPUT);
  digitalWrite(PCA9685_OE_PIN, HIGH);
  pwmOutputsOn = false;
#endif
}

bool dispenserIsBusy() { return dispenseBusy; }

bool dispenserPwmReady() { return pwmReady; }

bool dispenserServoSafe() { return !dispenseBusy; }

void dispenserSetup() {
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  Serial.printf("[dispenser] I2C SDA=GPIO%d SCL=GPIO%d slots=%d\n",
                I2C_SDA_PIN, I2C_SCL_PIN, DISPENSER_SLOT_COUNT);

#if DISPENSER_HAS_PCA9685
#if PCA9685_OE_PIN >= 0
  Serial.printf("[dispenser] OE on GPIO%d (HIGH=disable PWM)\n", PCA9685_OE_PIN);
#endif

  if (!pwm.begin()) {
    Serial.println("[dispenser] ERROR: pwm.begin() failed");
    pwmReady = false;
    return;
  }
  pwm.setOscillatorFrequency(27000000);
  pwm.setPWMFreq(PCA9685_PWM_FREQ);
  pwmReady = true;
  stopAllServos();
  pwmOutputsEnable(true);
  Serial.println("[dispenser] PCA9685 ready — all channels stopped");
#else
  Serial.println("[dispenser] PCA9685 lib not linked — stub mode");
#endif

  lastIdleStopMs = millis();
}

void dispenserLoop() {
  if (dispenseBusy || !pwmReady) return;
  const unsigned long now = millis();
  if (now - lastIdleStopMs < DISPENSER_IDLE_STOP_MS) return;
  stopAllServos();
  lastIdleStopMs = now;
}

bool dispenserDispenseSlot(uint8_t slotIndex) {
  if (slotIndex >= DISPENSER_SLOT_COUNT) return false;
#if DISPENSER_HAS_PCA9685
  if (!pwmReady) {
    Serial.println("[dispenser] ERROR: PCA9685 not ready");
    return false;
  }
  if (dispenseBusy) {
    Serial.println("[dispenser] rejected — dispense busy");
    return false;
  }
#endif

  Serial.printf("[web-cmd] spinning PCA9685 channel %u\n", slotIndex);
  Serial.printf("[dispenser] spin slot %u\n", slotIndex);

#if DISPENSER_HAS_PCA9685
  DispenseSlotGuard guard(static_cast<uint8_t>(slotIndex));
  writeServoPulse(slotIndex, SERVO_SPIN_US);
  spinWaitMs(SERVO_SPIN_MS);
  return true;
#else
  dispenseBusy = true;
  spinWaitMs(SERVO_SPIN_MS);
  dispenseBusy = false;
  return true;
#endif
}

bool dispenserDispenseAll() {
#if DISPENSER_HAS_PCA9685
  if (!pwmReady) {
    Serial.println("[dispenser] ERROR: PCA9685 not ready");
    return false;
  }
  if (dispenseBusy) {
    Serial.println("[dispenser] rejected — dispense busy");
    return false;
  }
#endif

  Serial.println("[web-cmd] dispense_all — spinning channels 0-9");
  bool allOk = true;
  for (uint8_t ch = 0; ch < DISPENSER_SLOT_COUNT; ch++) {
    if (!dispenserDispenseSlot(ch)) allOk = false;
    if (ch + 1 < DISPENSER_SLOT_COUNT) spinWaitMs(SERVO_ALL_GAP_MS);
  }
  Serial.printf("[web-cmd] dispense_all done ok=%s\n", allOk ? "true" : "false");
  return allOk;
}
