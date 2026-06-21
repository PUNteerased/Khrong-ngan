#pragma once

void camLinkSetup();
void camLinkLoop();
bool camLinkOnline();
bool camLinkPeerReady();
void camLinkRequestCapture();
bool camLinkRequestScan();
void camLinkResendScan();
void camLinkRequestScanStop();
void camLinkHttpScanKeepalive();
void camLinkOnQrPayload(const char* payload);
const char* camLinkPreviewUrl();
