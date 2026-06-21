#pragma once

void camLinkSetup();
void camLinkLoop();
bool camLinkOnline();
void camLinkRequestCapture();
void camLinkRequestScan();
void camLinkRequestScanStop();
void camLinkOnQrPayload(const char* payload);
