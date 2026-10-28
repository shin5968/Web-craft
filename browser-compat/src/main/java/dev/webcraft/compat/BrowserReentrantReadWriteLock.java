package dev.webcraft.compat;
import java.io.Serializable;
import java.util.*;
import java.util.concurrent.TimeUnit;

public class BrowserReentrantReadWriteLock implements BrowserReadWriteLock,Serializable {
    private final boolean fair;private final Map<Thread,Integer> readers=new IdentityHashMap<>();
    private Thread writer;private int writes;private final ReadLock read=new ReadLock(this);private final WriteLock write=new WriteLock(this);
    public BrowserReentrantReadWriteLock(){this(false);}public BrowserReentrantReadWriteLock(boolean fair){this.fair=fair;}
    public ReadLock readLock(){return read;}public WriteLock writeLock(){return write;}public final boolean isFair(){return fair;}
    public synchronized int getReadLockCount(){return readers.values().stream().mapToInt(Integer::intValue).sum();}
    public synchronized int getReadHoldCount(){return readers.getOrDefault(Thread.currentThread(),0);}
    public synchronized int getWriteHoldCount(){return writer==Thread.currentThread()?writes:0;}
    public synchronized boolean isWriteLocked(){return writer!=null;}
    public synchronized boolean isWriteLockedByCurrentThread(){return writer==Thread.currentThread();}
    public final boolean hasQueuedThreads(){return false;}public final int getQueueLength(){return 0;}
    public final boolean hasQueuedThread(Thread thread){Objects.requireNonNull(thread);return false;}
    protected synchronized Thread getOwner(){return writer;}
    public static class ReadLock implements BrowserLock,Serializable {
        final BrowserReentrantReadWriteLock lock;protected ReadLock(BrowserReentrantReadWriteLock lock){this.lock=Objects.requireNonNull(lock);}
        public boolean tryLock(){synchronized(lock){Thread current=Thread.currentThread();if(lock.writer!=null&&lock.writer!=current)return false;
            int n=lock.readers.getOrDefault(current,0);if(n==Integer.MAX_VALUE)throw new Error("Read lock overflow");lock.readers.put(current,n+1);return true;}}
        public void lock(){if(!tryLock())throw new UnsupportedOperationException("Contended read lock requires a scheduler");}
        public void lockInterruptibly() throws InterruptedException {if(Thread.interrupted())throw new InterruptedException();lock();}
        public boolean tryLock(long time,TimeUnit unit) throws InterruptedException {Objects.requireNonNull(unit);if(Thread.interrupted())throw new InterruptedException();if(tryLock())return true;if(time>0)throw new UnsupportedOperationException("Timed wait requires scheduler");return false;}
        public void unlock(){synchronized(lock){Thread current=Thread.currentThread();int n=lock.readers.getOrDefault(current,0);if(n==0)throw new IllegalMonitorStateException();if(n==1)lock.readers.remove(current);else lock.readers.put(current,n-1);}}
        public BrowserCondition newCondition(){throw new UnsupportedOperationException("Read lock cannot have a condition");}
    }
    public static class WriteLock implements BrowserLock,Serializable {
        final BrowserReentrantReadWriteLock lock;protected WriteLock(BrowserReentrantReadWriteLock lock){this.lock=Objects.requireNonNull(lock);}
        public boolean tryLock(){synchronized(lock){Thread current=Thread.currentThread();if(lock.writer!=null&&lock.writer!=current)return false;
            if(lock.writer==null&&!lock.readers.isEmpty())return false;
            if(lock.writes==Integer.MAX_VALUE)throw new Error("Write lock overflow");lock.writer=current;lock.writes++;return true;}}
        public void lock(){if(!tryLock())throw new UnsupportedOperationException("Contended write lock or read-to-write upgrade requires scheduler");}
        public void lockInterruptibly() throws InterruptedException {if(Thread.interrupted())throw new InterruptedException();lock();}
        public boolean tryLock(long time,TimeUnit unit) throws InterruptedException {Objects.requireNonNull(unit);if(Thread.interrupted())throw new InterruptedException();if(tryLock())return true;if(time>0)throw new UnsupportedOperationException("Timed wait requires scheduler");return false;}
        public void unlock(){synchronized(lock){if(lock.writer!=Thread.currentThread())throw new IllegalMonitorStateException();if(--lock.writes==0)lock.writer=null;}}
        public boolean isHeldByCurrentThread(){return lock.isWriteLockedByCurrentThread();}public int getHoldCount(){return lock.getWriteHoldCount();}
        public BrowserCondition newCondition(){throw new UnsupportedOperationException("Read/write conditions require scheduler");}
    }
}
