#pragma once

#include <Arduino.h>

bool pickupPreviewTicket(
    const char* code,
    const char* signature,
    String& outJson,
    String& errorOut);
bool pickupRedeemAndDispense(
    const char* code,
    const char* signature,
    String* errorOut = nullptr);
