package dev.webcraft.compat;
import java.io.*;
import java.net.*;
import java.util.*;

/** Read-only bundled classpath resources. Order and duplicate providers are retained. */
public final class BrowserResources {
    private static final Map<String,List<byte[]>> DATA=new LinkedHashMap<>();
    private static final Map<String,Class<?>> CLASSES=new HashMap<>();
    private BrowserResources(){}
    public static void register(String name,byte[] bytes){Objects.requireNonNull(bytes);name=valid(name);DATA.computeIfAbsent(name,k->new ArrayList<>()).add(bytes.clone());}
    public static void registerClass(String name,Class<?> type){CLASSES.put(Objects.requireNonNull(name),Objects.requireNonNull(type));}
    private static String valid(String name){Objects.requireNonNull(name);if(name.startsWith("/")||name.indexOf('\\')>=0||Arrays.asList(name.split("/",-1)).contains(".."))throw new IllegalArgumentException("Invalid classpath resource name");return name;}
    private static String relative(Class<?> type,String name){Objects.requireNonNull(type);Objects.requireNonNull(name);
        if(name.startsWith("/"))return name.substring(1);String owner=type.getName();int dot=owner.lastIndexOf('.');return dot<0?name:owner.substring(0,dot).replace('.','/')+'/'+name;}
    private static URL url(String name,int index){try{return new URL("webcraft", "classpath", -1, "/"+name+"?entry="+index,new URLStreamHandler(){
        protected boolean hostsEqual(URL first,URL second){return first.getHost().equals(second.getHost());}
        protected int hashCode(URL url){return Objects.hash(url.getProtocol(),url.getHost(),url.getPath(),url.getQuery());}
        protected URLConnection openConnection(URL url){return new URLConnection(url){
            public void connect(){connected=true;}
            public InputStream getInputStream() throws IOException {List<byte[]> values=DATA.get(name);if(values==null||index>=values.size())throw new FileNotFoundException(name);connect();return new ByteArrayInputStream(values.get(index));}
            public int getContentLength(){return DATA.get(name).get(index).length;}
        };}
    });}catch(MalformedURLException exception){throw new IllegalArgumentException(exception);}}
    public static URL getResource(ClassLoader loader,String name){return getSystemResource(name);}
    public static URL getResource(Class<?> type,String name){return getSystemResource(relative(type,name));}
    public static URL getSystemResource(String name){name=valid(name);return DATA.containsKey(name)?url(name,0):null;}
    public static Enumeration<URL> getResources(ClassLoader loader,String name) throws IOException{return getSystemResources(name);}
    public static Enumeration<URL> getSystemResources(String name) throws IOException {name=valid(name);List<URL> urls=new ArrayList<>();List<byte[]> values=DATA.get(name);if(values!=null)for(int i=0;i<values.size();i++)urls.add(url(name,i));return Collections.enumeration(urls);}
    public static InputStream getResourceAsStream(ClassLoader loader,String name){return getSystemResourceAsStream(name);}
    public static InputStream getResourceAsStream(Class<?> type,String name){return getSystemResourceAsStream(relative(type,name));}
    public static InputStream getSystemResourceAsStream(String name){name=valid(name);List<byte[]> values=DATA.get(name);return values==null?null:new ByteArrayInputStream(values.get(0));}
    public static Class<?> loadClass(ClassLoader loader,String name) throws ClassNotFoundException {Class<?> type=CLASSES.get(name);if(type==null)throw new ClassNotFoundException("Class not bundled for dynamic loading: "+name);return type;}
}
