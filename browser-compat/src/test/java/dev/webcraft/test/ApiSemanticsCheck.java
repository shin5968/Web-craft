package dev.webcraft.test;
import java.lang.ScopedValue;
import java.lang.StackWalker;
import java.util.*;
import java.util.concurrent.locks.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
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
        LockSupport.unpark(Thread.currentThread());LockSupport.park();checks++;
        LockSupport.unpark(Thread.currentThread());LockSupport.unpark(Thread.currentThread());LockSupport.park();checks++;
        LockSupport.parkNanos(0);LockSupport.parkNanos(-1);check(LockSupport.getBlocker(Thread.currentThread())==null);
        Object blocker=new Object();LockSupport.setCurrentBlocker(blocker);check(LockSupport.getBlocker(Thread.currentThread())==blocker);LockSupport.setCurrentBlocker(null);
        Thread.currentThread().interrupt();LockSupport.park();check(Thread.interrupted());
        LockSupport.unpark(null);checks++;
        int[] input={Integer.MAX_VALUE,7};AtomicIntegerArray ints=new AtomicIntegerArray(input);input[1]=99;
        check(ints.get(1)==7&&ints.length()==2);check(ints.incrementAndGet(0)==Integer.MIN_VALUE);
        check(ints.getAndAdd(1,5)==7&&ints.get(1)==12);check(!ints.compareAndSet(1,7,9));
        check(ints.compareAndExchange(1,12,20)==12&&ints.get(1)==20);
        check(ints.getAndUpdate(1,value->value+3)==20&&ints.updateAndGet(1,value->value*2)==46);
        check(ints.getAndAccumulate(1,4,Integer::sum)==46&&ints.accumulateAndGet(1,5,Integer::sum)==55);
        ints.setRelease(1,60);check(ints.getAcquire(1)==60);ints.setOpaque(1,61);check(ints.getPlain(1)==61);
        try{ints.get(2);throw new AssertionError();}catch(IndexOutOfBoundsException expected){checks++;}
        AtomicLongArray longs=new AtomicLongArray(new long[]{Long.MAX_VALUE,-9});
        check(longs.getAndIncrement(0)==Long.MAX_VALUE&&longs.get(0)==Long.MIN_VALUE);
        check(longs.getAndSet(1,1L<<40)==-9);check(longs.compareAndExchangeRelease(1,1L<<40,(1L<<50)+17)==1L<<40);
        check(longs.accumulateAndGet(1,3,Long::sum)==(1L<<50)+20);
        String first=new String("same"),equal=new String("same");
        AtomicReferenceArray<Object> refs=new AtomicReferenceArray<Object>(new String[]{first});
        check(!refs.compareAndSet(0,equal,"bad"));check(refs.compareAndSet(0,first,42));
        check(refs.getAndSet(0,null).equals(42)&&refs.get(0)==null);
        check(refs.updateAndGet(0,value->"updated").equals("updated"));
        check(refs.getAndAccumulate(0,"!",(left,right)->left.toString()+right).equals("updated")&&refs.get(0).equals("updated!"));
        check(ints.toString().equals("[-2147483648, 61]"));
        ConcurrentLinkedQueue<String> queue=new ConcurrentLinkedQueue<>();
        check(queue.poll()==null&&queue.peek()==null);queue.offer(first);queue.offer(equal);
        Iterator<String> iterator=queue.iterator();check(iterator.next()==first);check(queue.poll()==first);iterator.remove();
        check(queue.size()==1&&queue.peek()==equal);check(iterator.next()==equal);iterator.remove();check(queue.isEmpty());
        try{queue.offer(null);throw new AssertionError();}catch(NullPointerException expected){checks++;}
        queue.addAll(List.of("a","b","c"));check(queue.remove("b")&&new ArrayList<>(queue).equals(List.of("a","c")));
        queue.clear();check(queue.isEmpty());
        LinkedBlockingQueue<Integer> bounded=new LinkedBlockingQueue<>(2);bounded.put(1);check(bounded.offer(2)&&!bounded.offer(3));
        check(bounded.remainingCapacity()==0&&!bounded.offer(3,0,TimeUnit.NANOSECONDS));
        check(bounded.take()==1&&bounded.poll(0,TimeUnit.NANOSECONDS)==2&&bounded.poll(0,TimeUnit.NANOSECONDS)==null);
        bounded.addAll(List.of(4,5));List<Integer> drained=new ArrayList<>();check(bounded.drainTo(drained,1)==1&&drained.equals(List.of(4))&&bounded.peek()==5);
        check(bounded.drainTo(drained)==1&&drained.equals(List.of(4,5))&&bounded.remainingCapacity()==2);
        try{bounded.drainTo(bounded);throw new AssertionError();}catch(IllegalArgumentException expected){checks++;}
        try{new LinkedBlockingQueue<>(0);throw new AssertionError();}catch(IllegalArgumentException expected){checks++;}
        check(!(((Object)bounded) instanceof ConcurrentLinkedQueue));
        System.out.println("WEBCRAFT_APIS_OK "+checks);
    }
}
