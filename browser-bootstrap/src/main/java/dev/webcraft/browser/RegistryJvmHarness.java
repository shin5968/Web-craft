package dev.webcraft.browser;
import java.io.FileDescriptor;
import java.io.FileOutputStream;
import java.io.PrintStream;
/** JVM-only host reporter; the Wasm entry point never reaches this file API. */
public final class RegistryJvmHarness {
    public static void main(String[] args) throws Exception {
        RegistryBootstrap.main(args);
        String result=RegistryBootstrap.registryResult();
        if(result==null)throw new IllegalStateException("Registry bootstrap did not complete");
        PrintStream host=new PrintStream(new FileOutputStream(FileDescriptor.out),true,"UTF-8");
        host.println("WEBCRAFT_REGISTRY_OK "+result);host.flush();
    }
}
