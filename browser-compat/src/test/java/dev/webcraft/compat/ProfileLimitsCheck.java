package dev.webcraft.compat;
import java.util.NoSuchElementException;
public final class ProfileLimitsCheck {
    public static void main(String[] args) throws Exception {
        BrowserScopedValue<String> value=BrowserScopedValue.newInstance();
        BrowserScopedValue.where(value,"parent").run(()->{
            Thread thread=new Thread(()->{if(value.isBound())throw new AssertionError("Leaked scope");});
            thread.start();try{thread.join();}catch(InterruptedException error){throw new AssertionError(error);}
        });
        BrowserReentrantLock lock=new BrowserReentrantLock();lock.lock();
        boolean[] checks=new boolean[2];Thread other=new Thread(()->{checks[0]=!lock.tryLock();try{lock.lock();}catch(UnsupportedOperationException expected){checks[1]=true;}});
        other.start();other.join();if(!checks[0]||!checks[1])throw new AssertionError("Contention not explicit");
        try{lock.newCondition().await();throw new AssertionError();}catch(UnsupportedOperationException expected){}
        lock.unlock();
        try{BrowserStackWalker.getInstance().getCallerClass();throw new AssertionError();}catch(UnsupportedOperationException expected){}
        System.out.println("WEBCRAFT_PROFILE_LIMITS_OK");
    }
}
