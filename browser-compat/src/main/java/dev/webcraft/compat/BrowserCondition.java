package dev.webcraft.compat;
import java.util.Date;
import java.util.concurrent.TimeUnit;
public interface BrowserCondition {
    void await() throws InterruptedException;void awaitUninterruptibly();long awaitNanos(long nanos) throws InterruptedException;
    boolean await(long time,TimeUnit unit) throws InterruptedException;boolean awaitUntil(Date deadline) throws InterruptedException;
    void signal();void signalAll();
}
