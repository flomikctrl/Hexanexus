package com.hexanexus.puzzle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private boolean returningFromBackground = false;

    // Some Android WebViews keep document.visibilityState "visible" on Home.
    // Send a lifecycle signal while still on the UI thread, before pausing.
    private void pauseWorkshop() {
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().evaluateJavascript(
                "window.dispatchEvent(new Event('hexanexus:native-pause'))", null);
        }
    }

    @Override
    public void onPause() {
        returningFromBackground = true;
        pauseWorkshop();
        super.onPause();
    }

    @Override
    public void onResume() {
        if (returningFromBackground) pauseWorkshop();
        returningFromBackground = false;
        super.onResume();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (!hasFocus) pauseWorkshop();
    }
}
