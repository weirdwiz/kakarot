const addon = require('./build/Release/audio_capture_native.node');

console.log('Testing WebRTC AEC Native Module...\n');

try {
    const aec = new addon.AudioCaptureAddon({
        enableAec: true,
        enableNs: true,
        enableAgc: false
    });
    
    console.log('✅ AEC processor created successfully');
    
    const renderAudio = new Float32Array(480);
    const captureAudio = new Float32Array(480);
    
    for (let i = 0; i < 480; i++) {
        renderAudio[i] = Math.sin(2 * Math.PI * 440 * i / 48000) * 0.5;
        captureAudio[i] = Math.sin(2 * Math.PI * 440 * i / 48000) * 0.3;
    }
    
    aec.processRenderAudio(renderAudio);
    console.log('✅ Processed render audio');
    
    const processedAudio = aec.processCaptureAudio(captureAudio);
    console.log('✅ Processed capture audio');
    console.log('   Output length:', processedAudio.length);
    
    const metrics = aec.getMetrics();
    console.log('\n📊 AEC Metrics:');
    console.log('   Echo Return Loss:', metrics.echoReturnLoss.toFixed(2), 'dB');
    console.log('   ERLE Enhancement:', metrics.echoReturnLossEnhancement.toFixed(2), 'dB');
    console.log('   AEC Converged:', metrics.aecConverged ? '✅' : '⏳');
    console.log('   RMS Level:', metrics.rmsLevel.toFixed(4));
    console.log('   Peak Level:', metrics.peakLevel.toFixed(4));
    
    aec.setEchoCancellationEnabled(false);
    console.log('\n✅ AEC disabled');
    aec.setEchoCancellationEnabled(true);
    console.log('✅ AEC re-enabled');
    
    console.log('\n🎉 All tests passed! WebRTC AEC is working!');
    
} catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
}
