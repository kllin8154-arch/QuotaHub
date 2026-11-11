package com.aiquotahub.mobile;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(QuotaAndroidPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
