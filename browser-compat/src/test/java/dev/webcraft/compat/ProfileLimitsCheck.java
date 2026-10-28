package dev.webcraft.compat;
import java.util.NoSuchElementException;
public final class ProfileLimitsCheck {
    public static void main(String[] args) throws Exception {
        BrowserScopedValue<String> value=BrowserScopedValue.newInstance();
        boolean[] isolated={false};
        BrowserScopedValue.where(value,"parent").run(()->{
            Thread thread=new Thread(()->{isolated[0]=!value.isBound();});
            thread.start();try{thread.join();}catch(InterruptedException error){throw new AssertionError(error);}
        });
        if(!isolated[0])throw new AssertionError("Leaked scope");
        BrowserReentrantLock lock=new BrowserReentrantLock();lock.lock();
        boolean[] checks=new boolean[2];Thread other=new Thread(()->{checks[0]=!lock.tryLock();try{lock.lock();}catch(UnsupportedOperationException expected){checks[1]=true;}});
        other.start();other.join();if(!checks[0]||!checks[1])throw new AssertionError("Contention not explicit");
        try{lock.newCondition().await();throw new AssertionError();}catch(UnsupportedOperationException expected){}
        lock.unlock();
        try{BrowserStackWalker.getInstance().getCallerClass();throw new AssertionError();}catch(UnsupportedOperationException expected){}
        try{BrowserLockSupport.park();throw new AssertionError();}catch(UnsupportedOperationException expected){}
        BrowserLockSupport.unpark(Thread.currentThread());BrowserLockSupport.unpark(Thread.currentThread());BrowserLockSupport.park();
        try{BrowserLockSupport.park();throw new AssertionError("Permits accumulated");}catch(UnsupportedOperationException expected){}
        try{BrowserLockSupport.parkNanos(1);throw new AssertionError();}catch(UnsupportedOperationException expected){}
        BrowserLinkedBlockingQueue<Integer> queue=new BrowserLinkedBlockingQueue<>(1);
        try{queue.take();throw new AssertionError();}catch(UnsupportedOperationException expected){}
        queue.put(1);try{queue.put(2);throw new AssertionError();}catch(UnsupportedOperationException expected){}
        if(queue.take()!=1)throw new AssertionError("Queue data lost on unsupported wait");
        BrowserAtomicIntegerArray ints=new BrowserAtomicIntegerArray(1);
        BrowserAtomicLongArray longs=new BrowserAtomicLongArray(1);
        BrowserAtomicReferenceArray<Integer> refs=new BrowserAtomicReferenceArray<>(new Integer[]{0});
        BrowserConcurrentLinkedQueue<Integer> fifo=new BrowserConcurrentLinkedQueue<>();
        Thread[] workers=new Thread[2];
        for(int worker=0;worker<2;worker++){final int producer=worker;workers[worker]=new Thread(()->{
            for(int i=0;i<2000;i++){ints.getAndIncrement(0);longs.getAndIncrement(0);refs.updateAndGet(0,previous->previous+1);}
            for(int i=0;i<1000;i++)fifo.offer(producer*1000+i);
        });workers[worker].start();}
        for(Thread worker:workers)worker.join();
        if(ints.get(0)!=4000||longs.get(0)!=4000||refs.get(0)!=4000||fifo.size()!=2000)throw new AssertionError("Lost concurrent update");
        int[] last={-1,-1};for(Integer item;(item=fifo.poll())!=null;){int producer=item/1000,sequence=item%1000;if(sequence!=++last[producer])throw new AssertionError("FIFO order lost");}
        if(last[0]!=999||last[1]!=999)throw new AssertionError("Queue elements lost");
        System.out.println("WEBCRAFT_PROFILE_LIMITS_OK");
    }
}
