package com.balance.teleprompter;

import org.junit.Test;
import org.junit.Rule;
import org.junit.rules.TemporaryFolder;
import java.io.*;
import java.nio.file.Files;
import static org.junit.Assert.*;

public class RecordingLibraryTest {
    @Rule public TemporaryFolder temp = new TemporaryFolder();

    @Test public void streamsVideoWithoutChangingBytes() throws Exception {
        File folder = temp.newFolder("recordings");
        File video = new File(folder, "take.mp4");
        byte[] bytes = new byte[200_000];
        new java.util.Random(123).nextBytes(bytes);
        Files.write(video.toPath(), bytes);
        assertEquals(video.getCanonicalFile(), RecordingLibraryPlugin.validateSource(folder, video));
        ByteArrayOutputStream target = new ByteArrayOutputStream();
        RecordingLibraryPlugin.copy(video, target);
        assertArrayEquals(bytes, target.toByteArray());
        assertArrayEquals(bytes, Files.readAllBytes(video.toPath()));
    }

    @Test public void rejectsOutsideAndEmptyRecordings() throws Exception {
        File folder = temp.newFolder("recordings");
        File outside = temp.newFile("outside.mp4");
        Files.write(outside.toPath(), new byte[]{1});
        assertThrows(IOException.class, () -> RecordingLibraryPlugin.validateSource(folder, outside));
        File traversal = new File(folder, "../outside.mp4");
        assertThrows(IOException.class, () -> RecordingLibraryPlugin.validateSource(folder, traversal));
        File empty = new File(folder, "empty.mp4");
        assertTrue(empty.createNewFile());
        assertThrows(IOException.class, () -> RecordingLibraryPlugin.validateSource(folder, empty));
    }

    @Test public void failedDestinationKeepsOriginal() throws Exception {
        File source = temp.newFile("take.mp4");
        Files.write(source.toPath(), new byte[]{4,5,6});
        OutputStream failed = new OutputStream() { public void write(int value) throws IOException { throw new IOException("Full"); } };
        assertThrows(IOException.class, () -> RecordingLibraryPlugin.copy(source, failed));
        assertArrayEquals(new byte[]{4,5,6}, Files.readAllBytes(source.toPath()));
    }
}
