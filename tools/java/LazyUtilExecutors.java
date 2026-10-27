import java.nio.file.*;
import java.util.*;
import java.util.jar.*;
import org.objectweb.asm.*;
import org.objectweb.asm.tree.*;

/** Pinned structural port patch. Preserve factories, defer three eager calls. */
public final class LazyUtilExecutors implements Opcodes {
    private static final String OWNER = "net/minecraft/util/Util";
    private static final String TYPE = "Lnet/minecraft/TracingExecutor;";
    private static final List<String> FIELDS = List.of("BACKGROUND_EXECUTOR", "IO_POOL", "DOWNLOAD_POOL");

    static byte[] patch(byte[] input) {
        ClassNode node = new ClassNode(ASM9);
        new ClassReader(input).accept(node, 0);
        if (!node.name.equals(OWNER)) throw new IllegalStateException("Wrong class");
        MethodNode clinit = node.methods.stream().filter(m -> m.name.equals("<clinit>")).findFirst().orElseThrow();
        Map<String,InsnList> initializers = new LinkedHashMap<>();
        for (AbstractInsnNode insn : clinit.instructions.toArray()) {
            if (!(insn instanceof FieldInsnNode field) || field.getOpcode() != PUTSTATIC
                    || !field.owner.equals(OWNER) || !FIELDS.contains(field.name)) continue;
            if (!field.desc.equals(TYPE) || initializers.containsKey(field.name)) throw new IllegalStateException("Field changed");
            AbstractInsnNode call = field.getPrevious();
            if (!(call instanceof MethodInsnNode method) || method.getOpcode() != INVOKESTATIC
                    || !method.owner.equals(OWNER)) throw new IllegalStateException("Factory changed");
            boolean background = field.name.equals("BACKGROUND_EXECUTOR");
            String expectedName = background ? "makeExecutor" : "makeIoExecutor";
            String expectedDesc = background ? "(Ljava/lang/String;)"+TYPE : "(Ljava/lang/String;Z)"+TYPE;
            if (!method.name.equals(expectedName) || !method.desc.equals(expectedDesc)) throw new IllegalStateException("Factory signature changed");
            AbstractInsnNode start = call.getPrevious();
            if (!background) {
                int expected = field.name.equals("IO_POOL") ? ICONST_0 : ICONST_1;
                if (start.getOpcode() != expected) throw new IllegalStateException("Factory flag changed");
                start = start.getPrevious();
            }
            if (!(start instanceof LdcInsnNode literal) || !(literal.cst instanceof String)) throw new IllegalStateException("Factory name changed");
            InsnList copied = new InsnList();
            AbstractInsnNode cursor = start;
            while (cursor != field) {
                AbstractInsnNode next = cursor.getNext();
                clinit.instructions.remove(cursor);copied.add(cursor);cursor = next;
            }
            clinit.instructions.remove(field);initializers.put(field.name,copied);
        }
        if (!initializers.keySet().equals(new HashSet<>(FIELDS))) throw new IllegalStateException("Expected exactly three executor initializers");
        for (String name : FIELDS) {
            FieldNode field = node.fields.stream().filter(f -> f.name.equals(name)).findFirst().orElseThrow();
            if (!field.desc.equals(TYPE) || (field.access & (ACC_PRIVATE|ACC_STATIC|ACC_FINAL)) != (ACC_PRIVATE|ACC_STATIC|ACC_FINAL))
                throw new IllegalStateException("Expected private static final field");
            field.access &= ~ACC_FINAL;
        }
        // Only private field reads within Util can exist in legal original bytecode.
        for (MethodNode method : node.methods) {
            for (AbstractInsnNode insn : method.instructions.toArray()) {
                if (insn instanceof FieldInsnNode field && field.owner.equals(OWNER) && FIELDS.contains(field.name)) {
                    if (field.getOpcode() != GETSTATIC) throw new IllegalStateException("Unexpected remaining executor write");
                    method.instructions.set(field,new MethodInsnNode(INVOKESTATIC,OWNER,"webcraft$lazy$"+field.name,"()"+TYPE,false));
                }
            }
        }
        for (String name : FIELDS) {
            MethodNode getter = new MethodNode(ASM9,ACC_PRIVATE|ACC_STATIC|ACC_SYNCHRONIZED,"webcraft$lazy$"+name,"()"+TYPE,null,null);
            LabelNode ready = new LabelNode();
            getter.instructions.add(new FieldInsnNode(GETSTATIC,OWNER,name,TYPE));
            getter.instructions.add(new InsnNode(DUP));
            getter.instructions.add(new JumpInsnNode(IFNONNULL,ready));
            getter.instructions.add(new InsnNode(POP));
            getter.instructions.add(initializers.get(name));
            getter.instructions.add(new InsnNode(DUP));
            getter.instructions.add(new FieldInsnNode(PUTSTATIC,OWNER,name,TYPE));
            getter.instructions.add(ready);getter.instructions.add(new InsnNode(ARETURN));
            node.methods.add(getter);
        }
        ClassWriter writer = new ClassWriter(ClassWriter.COMPUTE_FRAMES|ClassWriter.COMPUTE_MAXS);
        node.accept(writer);return writer.toByteArray();
    }
    public static void main(String[] args) throws Exception {
        int changed=0;
        try (JarFile jar=new JarFile(args[0]); JarOutputStream output=new JarOutputStream(Files.newOutputStream(Path.of(args[1])))) {
            for (var entries=jar.entries();entries.hasMoreElements();) {
                JarEntry entry=entries.nextElement();
                // Signatures cannot describe a deliberately patched archive.
                String upper=entry.getName().toUpperCase(Locale.ROOT);
                if (upper.startsWith("META-INF/") && (upper.endsWith(".SF")||upper.endsWith(".RSA")||upper.endsWith(".DSA"))) continue;
                byte[] bytes=jar.getInputStream(entry).readAllBytes();
                if(entry.getName().equals(OWNER+".class")){bytes=patch(bytes);changed++;}
                output.putNextEntry(new JarEntry(entry.getName()));output.write(bytes);output.closeEntry();
            }
        }
        if(changed!=1)throw new IllegalStateException("Expected exactly one Util class");
        System.out.println("Deferred exactly three original executor factories; no replacement executors or game stubs.");
    }
}
