package dev.webcraft.compat;
import java.util.*;
import java.io.Serializable;

/** Monitor-backed FIFO. Snapshot iterators retain node identity for remove(). */
public abstract class BrowserQueueBase<E> extends AbstractQueue<E> implements Serializable {
    private static final class Node<E> implements Serializable {final E value;Node(E value){this.value=value;}}
    private final LinkedList<Node<E>> nodes=new LinkedList<>();
    protected final int capacity;
    protected BrowserQueueBase(){this(Integer.MAX_VALUE);}
    protected BrowserQueueBase(int capacity){if(capacity<=0)throw new IllegalArgumentException();this.capacity=capacity;}
    protected BrowserQueueBase(Collection<? extends E> source){this();addAll(source);}
    public synchronized boolean offer(E value){Objects.requireNonNull(value);if(nodes.size()==capacity)return false;nodes.addLast(new Node<>(value));return true;}
    public synchronized E poll(){return nodes.isEmpty()?null:nodes.removeFirst().value;}
    public synchronized E peek(){return nodes.isEmpty()?null:nodes.getFirst().value;}
    public synchronized int size(){return nodes.size();}
    public synchronized void clear(){nodes.clear();}
    public synchronized boolean contains(Object value){if(value==null)return false;for(Node<E> node:nodes)if(value.equals(node.value))return true;return false;}
    public synchronized boolean remove(Object value){if(value==null)return false;Iterator<Node<E>> iterator=nodes.iterator();while(iterator.hasNext())if(value.equals(iterator.next().value)){iterator.remove();return true;}return false;}
    private synchronized void removeNode(Node<E> node){nodes.remove(node);}
    public synchronized Iterator<E> iterator(){Iterator<Node<E>> snapshot=new ArrayList<>(nodes).iterator();return new Iterator<>(){
        Node<E> last;
        public boolean hasNext(){return snapshot.hasNext();}
        public E next(){last=snapshot.next();return last.value;}
        public void remove(){if(last==null)throw new IllegalStateException();removeNode(last);last=null;}
    };}
    protected synchronized int drain(Collection<? super E> target,int maximum){Objects.requireNonNull(target);if(target==this)throw new IllegalArgumentException("Cannot drain to self");
        int count=0;while(count<maximum&&!nodes.isEmpty()){target.add(nodes.getFirst().value);nodes.removeFirst();count++;}return count;}
}
