#pragma once

void camLinkSetup();
void camLinkLoop();
bool camLinkOnline();
bool camLinkPeerReady();
void camLinkRequestCapture();
bool camLinkRequestScan();
void camLinkRequestScanStop();
void camLinkOnQrPayload(const char* payload);
const char* camLinkPreviewUrl();
