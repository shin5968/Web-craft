package dev.webcraft.compat;
import java.util.*;
import java.util.concurrent.TimeUnit;

/** Immediate BlockingQueue operations. Suspension requires a separate scheduler. */
public class BrowserLinkedBlockingQueue<E> extends BrowserQueueBase<E> implements BrowserBlockingQueue<E> {
    public BrowserLinkedBlockingQueue(){super();}public BrowserLinkedBlockingQueue(int capacity){super(capacity);}
    public BrowserLinkedBlockingQueue(Collection<? extends E> source){this();addAll(source);}
    private static void interrupted() throws InterruptedException {if(Thread.interrupted())throw new InterruptedException();}
    public void put(E value) throws InterruptedException {Objects.requireNonNull(value);interrupted();if(!offer(value))throw new UnsupportedOperationException("Full queue put requires a scheduler");}
    public E take() throws InterruptedException {interrupted();E value=poll();if(value==null)throw new UnsupportedOperationException("Empty queue take requires a scheduler");return value;}
    public boolean offer(E value,long timeout,TimeUnit unit) throws InterruptedException {Objects.requireNonNull(unit);interrupted();if(offer(value))return true;if(timeout>0)throw new UnsupportedOperationException("Timed queue offer requires a scheduler");return false;}
    public E poll(long timeout,TimeUnit unit) throws InterruptedException {Objects.requireNonNull(unit);interrupted();E value=poll();if(value!=null||timeout<=0)return value;throw new UnsupportedOperationException("Timed queue poll requires a scheduler");}
    public synchronized int remainingCapacity(){return capacity-size();}
    public int drainTo(Collection<? super E> target){return drain(target,Integer.MAX_VALUE);}
    public int drainTo(Collection<? super E> target,int maximum){return drain(target,maximum);}
}
