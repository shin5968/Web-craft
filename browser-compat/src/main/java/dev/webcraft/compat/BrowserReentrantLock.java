package dev.webcraft.compat;

import java.io.Serializable;
import java.util.*;
import java.util.concurrent.TimeUnit;

/** Non-blocking event-loop profile: real ownership/recursion; contention is explicit. */
public class BrowserReentrantLock implements BrowserLock,Serializable {
    private transient Thread owner;private transient int holds;private final boolean fair;
    public BrowserReentrantLock(){this(false);}public BrowserReentrantLock(boolean fair){this.fair=fair;}
    public synchronized boolean tryLock(){Thread current=Thread.currentThread();if(owner!=null&&owner!=current)return false;
        if(holds==Integer.MAX_VALUE)throw new Error("Lock recursion overflow");owner=current;holds++;return true;}
    public void lock(){if(!tryLock())throw new UnsupportedOperationException("Contended blocking lock requires a scheduler");}
    public void lockInterruptibly() throws InterruptedException {if(Thread.interrupted())throw new InterruptedException();lock();}
    public boolean tryLock(long time,TimeUnit unit) throws InterruptedException {
        Objects.requireNonNull(unit);if(Thread.interrupted())throw new InterruptedException();
        if(tryLock())return true;if(time>0)throw new UnsupportedOperationException("Timed lock wait requires a scheduler");return false;
    }
    public synchronized void unlock(){if(owner!=Thread.currentThread())throw new IllegalMonitorStateException("Not lock owner");if(--holds==0)owner=null;}
    public synchronized int getHoldCount(){return owner==Thread.currentThread()?holds:0;}
    public synchronized boolean isHeldByCurrentThread(){return owner==Thread.currentThread();}
    public synchronized boolean isLocked(){return owner!=null;}
    protected synchronized Thread getOwner(){return owner;}
    public final boolean isFair(){return fair;}
    public final boolean hasQueuedThreads(){return false;}public final int getQueueLength(){return 0;}
    public final boolean hasQueuedThread(Thread thread){Objects.requireNonNull(thread);return false;}
    protected Collection<Thread> getQueuedThreads(){return List.of();}
    public BrowserCondition newCondition(){return new CheckedCondition(this);}
    public boolean hasWaiters(BrowserCondition condition){checkCondition(condition);return false;}
    public int getWaitQueueLength(BrowserCondition condition){checkCondition(condition);return 0;}
    protected Collection<Thread> getWaitingThreads(BrowserCondition condition){checkCondition(condition);return List.of();}
    private void checkCondition(BrowserCondition condition){Objects.requireNonNull(condition);
        if(!(condition instanceof CheckedCondition checked)||checked.lock!=this)throw new IllegalArgumentException("Foreign condition");
        if(!isHeldByCurrentThread())throw new IllegalMonitorStateException();}
    static final class CheckedCondition implements BrowserCondition {
        final BrowserReentrantLock lock;CheckedCondition(BrowserReentrantLock lock){this.lock=lock;}
        private void check(){if(!lock.isHeldByCurrentThread())throw new IllegalMonitorStateException();}
        private UnsupportedOperationException waiting(){check();return new UnsupportedOperationException("Condition wait requires a scheduler");}
        public void await() throws InterruptedException {if(Thread.interrupted())throw new InterruptedException();throw waiting();}
        public void awaitUninterruptibly(){throw waiting();}
        public long awaitNanos(long nanos) throws InterruptedException {await();return 0;}
        public boolean await(long time,TimeUnit unit) throws InterruptedException {Objects.requireNonNull(unit);await();return false;}
        public boolean awaitUntil(Date date) throws InterruptedException {Objects.requireNonNull(date);await();return false;}
        public void signal(){check();}public void signalAll(){check();}
    }
}
