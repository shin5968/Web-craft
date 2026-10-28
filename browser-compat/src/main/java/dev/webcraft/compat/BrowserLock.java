package dev.webcraft.compat;
import java.util.concurrent.TimeUnit;
public interface BrowserLock {
    void lock();void lockInterruptibly() throws InterruptedException;boolean tryLock();
    boolean tryLock(long time,TimeUnit unit) throws InterruptedException;void unlock();BrowserCondition newCondition();
}
