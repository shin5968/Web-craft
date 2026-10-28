package dev.webcraft.test;
import java.lang.ScopedValue;
import java.util.*;
import java.util.concurrent.locks.*;
import java.io.*;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Same source runs on Java 25 and, after type/call-site mapping, Wasm GC. */
public final class ApiSemanticsCheck {
    private static int checks;
    static void check(boolean condition){if(!condition)throw new AssertionError("Check "+checks);checks++;}
    public static void main(String[] args) throws Exception {
        ScopedValue<String> key=ScopedValue.newInstance(),other=ScopedValue.newInstance();
        check(!key.isBound());check(key.orElse("fallback").equals("fallback"));
        try{key.get();throw new AssertionError();}catch(NoSuchElementException expected){checks++;}
        var carrier=ScopedValue.where(key,"outer").where(other,"second");
        check(carrier.get(key).equals("outer"));
        carrier.run(()->{
            check(key.get().equals("outer"));check(other.get().equals("second"));
            ScopedValue.where(key,"inner").run(()->check(key.get().equals("inner")));
            check(key.get().equals("outer"));
            try{ScopedValue.where(key,"error").run(()->{throw new IllegalStateException();});}catch(IllegalStateException expected){checks++;}
            check(key.get().equals("outer"));
        });
        check(!key.isBound()&&!other.isBound());
        check(ScopedValue.where(key,"first").where(key,"last").call(()->key.get()).equals("last"));
        ScopedValue.where(key,null).run(()->check(key.isBound()&&key.get()==null));
        try{ScopedValue.where(key,"checked").call(()->{throw new IOException("checked");});throw new AssertionError();}catch(IOException expected){checks++;}
        check(!key.isBound());
        ReentrantLock lock=new ReentrantLock(true);check(lock.isFair()&&!lock.isLocked());
        lock.lock();lock.lock();check(lock.getHoldCount()==2&&lock.isHeldByCurrentThread());
        check(lock.tryLock()&&lock.getHoldCount()==3);lock.unlock();lock.unlock();
        var condition=lock.newCondition();condition.signal();condition.signalAll();check(!lock.hasWaiters(condition));
        lock.unlock();check(!lock.isLocked());
        try{lock.unlock();throw new AssertionError();}catch(IllegalMonitorStateException expected){checks++;}
        try{condition.signal();throw new AssertionError();}catch(IllegalMonitorStateException expected){checks++;}
        ReentrantReadWriteLock rw=new ReentrantReadWriteLock();rw.readLock().lock();rw.readLock().lock();
        check(rw.getReadHoldCount()==2&&!rw.writeLock().tryLock());rw.readLock().unlock();rw.readLock().unlock();
        rw.writeLock().lock();rw.writeLock().lock();check(rw.getWriteHoldCount()==2);
        rw.readLock().lock();rw.writeLock().unlock();rw.writeLock().unlock();check(!rw.isWriteLocked()&&rw.getReadHoldCount()==1);rw.readLock().unlock();
        URL resource=ApiSemanticsCheck.class.getResource("/fixtures/sample.txt");check(resource!=null);
        try(InputStream stream=resource.openStream()){check(new String(stream.readAllBytes(),StandardCharsets.UTF_8).equals("browser-resource"));}
        check(ApiSemanticsCheck.class.getResource("/fixtures/missing.txt")==null);
        var urls=ApiSemanticsCheck.class.getClassLoader().getResources("fixtures/providers.txt");
        List<String> found=new ArrayList<>();while(urls.hasMoreElements()){try(InputStream stream=urls.nextElement().openStream()){found.add(new String(stream.readAllBytes(),StandardCharsets.UTF_8));}}
        check(found.equals(List.of("first","second")));
        check(ApiSemanticsCheck.class.getClassLoader().loadClass("java.lang.String")==String.class);
        System.out.println("WEBCRAFT_APIS_OK "+checks);
    }
}
