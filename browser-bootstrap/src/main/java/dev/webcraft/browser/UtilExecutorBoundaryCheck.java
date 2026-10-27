package dev.webcraft.browser;

import java.lang.reflect.Field;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;
import net.minecraft.TracingExecutor;
import net.minecraft.util.Util;

/** JVM-only semantic check; never a Wasm or game entry point. */
public final class UtilExecutorBoundaryCheck {
    public static void main(String[] args) throws Exception {
        try {
            Util.getMillis();
            String[] names={"BACKGROUND_EXECUTOR","IO_POOL","DOWNLOAD_POOL"};
            Supplier<TracingExecutor>[] accessors=new Supplier[]{
                (Supplier<TracingExecutor>)Util::backgroundExecutor,
                (Supplier<TracingExecutor>)Util::ioPool,
                (Supplier<TracingExecutor>)Util::nonCriticalIoPool};
            for(String name:names) {
                Field field=Util.class.getDeclaredField(name);field.setAccessible(true);
                if(field.get(null)!=null)throw new AssertionError("Eager executor: "+name);
            }
            for(int i=0;i<names.length;i++) {
                TracingExecutor executor=accessors[i].get();
                if(executor==null||executor!=accessors[i].get())throw new AssertionError("Identity: "+names[i]);
                CountDownLatch completed=new CountDownLatch(1);
                executor.execute(completed::countDown);
                if(!completed.await(10,TimeUnit.SECONDS))throw new AssertionError("Task did not run: "+names[i]);
            }
            System.out.println("WEBCRAFT_LAZY_EXECUTORS_OK");
        } finally { Util.shutdownExecutors(); }
    }
}
