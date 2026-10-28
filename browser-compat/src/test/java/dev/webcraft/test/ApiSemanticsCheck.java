package dev.webcraft.test;
import java.lang.ScopedValue;
import java.lang.StackWalker;
import java.util.*;
import java.util.concurrent.locks.*;
import java.io.*;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Same source runs on Java 25 and, after type/call-site mapping, Wasm GC. */
public final class ApiSemanticsCheck {
    private static int checks;
    static void check(boolean condition){if(!condition)throw new AssertionError("Check "+checks);checks++;}
    private static Class<?> caller(){return StackWalker.getInstance(StackWalker.Option.RETAIN_CLASS_REFERENCE).getCallerClass();}
    private static List<String> methods(){return StackWalker.getInstance().walk(frames->frames.limit(2).map(StackWalker.StackFrame::getMethodName).toList());}
    private static void thrownFrame(){throw new IllegalStateException("frame cleanup");}
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
        check(caller()==ApiSemanticsCheck.class);check(methods().equals(List.of("methods","main")));
        try{thrownFrame();}catch(IllegalStateException expected){checks++;}
        check(methods().equals(List.of("methods","main")));
        try(InputStream stream=ClassLoader.getSystemResourceAsStream("fixtures/sample.txt")){check(stream!=null&&stream.read()==98);}
        check(ClassLoader.getSystemResource("fixtures/sample.txt")!=null);
        try(InputStream stream=ApiSemanticsCheck.class.getResourceAsStream("/fixtures/sample.txt")){check(stream!=null&&stream.read()==98);}
        try(InputStream stream=ApiSemanticsCheck.class.getClassLoader().getResourceAsStream("fixtures/sample.txt")){check(stream!=null&&stream.read()==98);}
        check(ApiSemanticsCheck.class.getClassLoader().getResource("/fixtures/sample.txt")==null);
        check(Collections.list(ClassLoader.getSystemResources("fixtures/providers.txt")).size()==2);
        System.out.println("WEBCRAFT_APIS_OK "+checks);
    }
}
