package dev.webcraft.compat;
import java.util.Collection;
public class BrowserConcurrentLinkedQueue<E> extends BrowserQueueBase<E> {
    public BrowserConcurrentLinkedQueue(){super();}
    public BrowserConcurrentLinkedQueue(Collection<? extends E> source){super(source);}
}
