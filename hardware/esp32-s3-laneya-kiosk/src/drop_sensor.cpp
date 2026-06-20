#include "drop_sensor.h"

#if __has_include("config.h")
#include "config.h"
#else
#include "config.example.h"
#endif

static unsigned long leftCount = 0;
static unsigned long rightCount = 0;
static bool leftPrevBlocked = false;
static bool rightPrevBlocked = false;

static bool isBlocked(uint8_t pin) {
  const int level = digitalRead(pin);
#if IR_DROP_ACTIVE_LOW
  return level == LOW;
#else
  return level == HIGH;
#endif
}

void dropSensorSetup() {
  pinMode(IR_DROP_LEFT_PIN, INPUT);
  pinMode(IR_DROP_RIGHT_PIN, INPUT);
  leftPrevBlocked = isBlocked(IR_DROP_LEFT_PIN);
  rightPrevBlocked = isBlocked(IR_DROP_RIGHT_PIN);
  Serial.printf("[drop] IR left=GPIO%d right=GPIO%d ready\n",
                IR_DROP_LEFT_PIN, IR_DROP_RIGHT_PIN);
}

void dropSensorLoop() {
  const bool leftBlocked = isBlocked(IR_DROP_LEFT_PIN);
  const bool rightBlocked = isBlocked(IR_DROP_RIGHT_PIN);

  if (leftBlocked && !leftPrevBlocked) {
    leftCount++;
    Serial.printf("[drop] LEFT beam broken (count=%lu)\n", leftCount);
  }
  if (rightBlocked && !rightPrevBlocked) {
    rightCount++;
    Serial.printf("[drop] RIGHT beam broken (count=%lu)\n", rightCount);
  }

  leftPrevBlocked = leftBlocked;
  rightPrevBlocked = rightBlocked;
}

bool dropSensorLeftBlocked() { return isBlocked(IR_DROP_LEFT_PIN); }
bool dropSensorRightBlocked() { return isBlocked(IR_DROP_RIGHT_PIN); }
unsigned long dropSensorLeftCount() { return leftCount; }
unsigned long dropSensorRightCount() { return rightCount; }
