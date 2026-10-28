package dev.webcraft.compat;
import java.util.*;
import java.util.concurrent.TimeUnit;
public interface BrowserBlockingQueue<E> extends Queue<E> {
    void put(E value) throws InterruptedException;boolean offer(E value,long timeout,TimeUnit unit) throws InterruptedException;
    E take() throws InterruptedException;E poll(long timeout,TimeUnit unit) throws InterruptedException;
    int remainingCapacity();int drainTo(Collection<? super E> target);int drainTo(Collection<? super E> target,int maximum);
}
